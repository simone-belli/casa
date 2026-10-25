/**
 * Turning items into occurrences: one per dated item, one per date of a
 * series (with its changed or ticked-off occurrences applied), and one for
 * each undated task.
 */

import { expandDates, occurrenceKey, parseRecurrence } from "./recurrence";
import { addDays, daysBetween, utcStamp, zonedParts, zonedToUtc } from "./time";
import type { AgendaItem } from "./types";

export type Occurrence = {
  /** Unique on screen: the row's id, or the series id and occurrence key. */
  key: string;
  /** The row with this occurrence's details: the item, the series, or the changed occurrence. */
  item: AgendaItem;
  /** The series this belongs to, if any. */
  series: AgendaItem | null;
  /** Its original start within the series (see occurrenceKey). */
  occurrence: string | null;
  /** The changed occurrence's own row, if there is one. */
  exception: AgendaItem | null;
  allDay: boolean;
  /** Local start date in the viewer's time zone; null for undated tasks. */
  date: string | null;
  /** Local last day (inclusive); same as date for one-day items. */
  endDate: string | null;
  /** Timed: UTC instants. */
  startsAt: string | null;
  endsAt: string | null;
  done: boolean;
};

export const isDated = (item: AgendaItem) => item.all_day || item.starts_at !== null;

/** The local last day of a timed item (an end at midnight belongs to the day before). */
function timedEndDate(startsAt: string, endsAt: string | null, timeZone: string): string {
  const start = zonedParts(startsAt, timeZone).date;
  if (!endsAt || endsAt <= startsAt) return start;
  const end = zonedParts(new Date(new Date(endsAt).getTime() - 1), timeZone).date;
  return end < start ? start : end;
}

/** An occurrence for one row as it is (not a series). */
export function singleOccurrence(item: AgendaItem, viewerZone: string, series: AgendaItem | null = null): Occurrence {
  const base = {
    key: item.id,
    item,
    series,
    occurrence: item.original_start,
    exception: series ? item : null,
    allDay: item.all_day,
    done: item.task_status === "done",
  };
  if (item.all_day && item.start_date) {
    return { ...base, date: item.start_date, endDate: item.end_date ?? item.start_date, startsAt: null, endsAt: null };
  }
  if (item.starts_at) {
    return {
      ...base,
      date: zonedParts(item.starts_at, viewerZone).date,
      endDate: timedEndDate(item.starts_at, item.ends_at, viewerZone),
      startsAt: item.starts_at,
      endsAt: item.ends_at,
    };
  }
  return { ...base, date: null, endDate: null, startsAt: null, endsAt: null };
}

/** The changed occurrences of each series, by series id and occurrence key. */
export function exceptionsBySeries(items: AgendaItem[]): Map<string, Map<string, AgendaItem>> {
  const map = new Map<string, Map<string, AgendaItem>>();
  for (const item of items) {
    if (!item.recurring_item_id || !item.original_start) continue;
    let forSeries = map.get(item.recurring_item_id);
    if (!forSeries) map.set(item.recurring_item_id, (forSeries = new Map()));
    forSeries.set(item.original_start, item);
  }
  return map;
}

/**
 * Every occurrence of a series that starts on or before `to` (local dates in
 * the series' time zone), in order. Cancelled occurrences and EXDATEs are
 * left out; changed ones carry their own details.
 */
export function seriesOccurrences(
  series: AgendaItem,
  exceptions: Map<string, AgendaItem> | undefined,
  to: string,
  viewerZone: string,
): Occurrence[] {
  const rule = parseRecurrence(series.recurrence, series.time_zone, series.all_day);
  if (!rule || !isDated(series)) return [singleOccurrence(series, viewerZone)];
  const skipped = new Set(rule.exdates);
  const result: Occurrence[] = [];

  const push = (key: string, generated: () => Occurrence) => {
    if (skipped.has(key)) return;
    const exception = exceptions?.get(key);
    if (exception) {
      if (!exception.cancelled) result.push(singleOccurrence(exception, viewerZone, series));
      return;
    }
    result.push(generated());
  };

  if (series.all_day && series.start_date) {
    const length = series.end_date ? daysBetween(series.start_date, series.end_date) : 0;
    for (const date of expandDates(rule, series.start_date, to)) {
      push(date, () => ({
        key: `${series.id}:${date}`,
        item: series,
        series,
        occurrence: date,
        exception: null,
        allDay: true,
        date,
        endDate: addDays(date, length),
        startsAt: null,
        endsAt: null,
        done: false,
      }));
    }
  } else if (series.starts_at) {
    const local = zonedParts(series.starts_at, series.time_zone);
    const duration = series.ends_at ? new Date(series.ends_at).getTime() - new Date(series.starts_at).getTime() : null;
    const timed = { time: local.time, timeZone: series.time_zone };
    // Expand a day further: in the viewer's zone an occurrence may fall a day later.
    for (const date of expandDates(rule, local.date, addDays(to, 1), timed)) {
      const startsAt = utcStamp(zonedToUtc(date, local.time, series.time_zone));
      const key = occurrenceKey(date, timed);
      push(key, () => {
        const endsAt = duration === null ? null : utcStamp(new Date(new Date(startsAt).getTime() + duration));
        return {
          key: `${series.id}:${key}`,
          item: series,
          series,
          occurrence: key,
          exception: null,
          allDay: false,
          date: zonedParts(startsAt, viewerZone).date,
          endDate: timedEndDate(startsAt, endsAt, viewerZone),
          startsAt,
          endsAt,
          done: false,
        };
      });
    }
  }
  return result.sort(compareOccurrences);
}

/** Dated first by start, then undated by when they were added. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date && b.date) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    // All-day before timed on the same day.
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) return a.startsAt < b.startsAt ? -1 : 1;
    return a.item.title.localeCompare(b.item.title);
  }
  if (a.date) return -1;
  if (b.date) return 1;
  return a.item.created_at < b.item.created_at ? -1 : a.item.created_at > b.item.created_at ? 1 : 0;
}

/** Every dated occurrence that touches the days from `from` to `to` (inclusive), in order. */
export function occurrencesBetween(items: AgendaItem[], from: string, to: string, viewerZone: string): Occurrence[] {
  const exceptions = exceptionsBySeries(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: Occurrence[] = [];
  for (const item of items) {
    if (item.recurring_item_id) {
      // Changed occurrences are listed with their series; orphans are dropped.
      continue;
    }
    if (!isDated(item)) continue;
    const list = item.recurrence ? seriesOccurrences(item, exceptions.get(item.id), to, viewerZone) : [singleOccurrence(item, viewerZone)];
    for (const occ of list) {
      if (occ.date && occ.endDate && occ.date <= to && occ.endDate >= from) result.push(occ);
    }
  }
  // An exception moved outside its series' expanded range is still shown.
  for (const item of items) {
    if (!item.recurring_item_id || item.cancelled || !byId.has(item.recurring_item_id)) continue;
    const series = byId.get(item.recurring_item_id)!;
    if (!series.recurrence) continue;
    const occ = singleOccurrence(item, viewerZone, series);
    if (occ.date && occ.endDate && occ.date <= to && occ.endDate >= from && !result.some((r) => r.key === occ.key)) {
      result.push(occ);
    }
  }
  return result.sort(compareOccurrences);
}
