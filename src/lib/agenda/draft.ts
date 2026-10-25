/** The add/edit form's state, and turning it into item fields. */

import { assigneeChoice, assigneeIds, type Assignee } from "./assign";
import type { Occurrence } from "./occurrences";
import { buildRecurrence, NO_REPEAT, repeatChoiceOf, type RepeatChoice } from "./recurrence";
import { addDays, daysBetween, utcStamp, zonedParts, zonedToUtc } from "./time";
import type { AgendaItem, ItemKind } from "./types";

export type Draft = {
  kind: ItemKind;
  title: string;
  note: string;
  /** Tasks can be undated; events always have a date. */
  dated: boolean;
  allDay: boolean;
  /** Start date (YYYY-MM-DD). */
  date: string;
  /** Last day: all-day items, inclusive; timed items, the day the end time is on. */
  endDate: string;
  /** HH:MM, timed items only. */
  startTime: string;
  /** HH:MM, or "" for a task with no end time. */
  endTime: string;
  /** "custom" keeps a rule the form can't show (e.g. one made in Google). */
  repeat: RepeatChoice | "custom";
  keepMissed: boolean;
  assignee: Assignee;
  /** Minutes before the start, or null for no reminder. */
  reminder: number | null;
};

/** The next whole hour after now, as HH:MM, and that hour's date. */
function nextHour(now: Date, timeZone: string): { date: string; time: string } {
  const { date, time } = zonedParts(now, timeZone);
  const hour = Number(time.slice(0, 2)) + 1;
  return hour >= 24 ? { date: addDays(date, 1), time: "00:00" } : { date, time: `${String(hour).padStart(2, "0")}:00` };
}

const plusHour = (time: string) => `${String((Number(time.slice(0, 2)) + 1) % 24).padStart(2, "0")}${time.slice(2)}`;

/** Switches between event and task: events always have a date and an end time. */
export function withKind(draft: Draft, kind: ItemKind): Draft {
  if (kind === "task") return { ...draft, kind };
  return { ...draft, kind, dated: true, endTime: draft.endTime || plusHour(draft.startTime) };
}

/** A new item: an undated task, or an event on `date` at the next hour. */
export function newDraft(kind: ItemKind, timeZone: string, date?: string, now: Date = new Date()): Draft {
  const next = nextHour(now, timeZone);
  const day = date ?? next.date;
  return {
    kind,
    title: "",
    note: "",
    dated: kind === "event" || Boolean(date),
    allDay: false,
    date: day,
    endDate: next.time === "23:00" && !date ? addDays(day, 1) : day,
    startTime: next.time,
    endTime: kind === "event" ? plusHour(next.time) : "",
    repeat: NO_REPEAT,
    keepMissed: false,
    assignee: "unassigned",
    reminder: null,
  };
}

/** The form for an existing item or occurrence, in the viewer's time zone. */
export function draftFromOccurrence(occ: Occurrence, viewerZone: string, me: string): Draft {
  const item = occ.item;
  const series = occ.series;
  const base = {
    kind: item.kind,
    title: item.title,
    note: item.note ?? "",
    keepMissed: (series ?? item).keep_missed,
    assignee: assigneeChoice((series ?? item).assignees, me),
    reminder: item.reminder_minutes,
  };
  const repeat = series
    ? repeatChoiceOf(series.recurrence, series.start_date ?? zonedParts(series.starts_at!, series.time_zone).date)
    : NO_REPEAT;

  if (occ.date === null) {
    const empty = newDraft(item.kind, viewerZone);
    return { ...empty, ...base, dated: false, repeat: NO_REPEAT };
  }
  if (occ.allDay) {
    return { ...base, dated: true, allDay: true, date: occ.date, endDate: occ.endDate ?? occ.date, startTime: "09:00", endTime: item.kind === "event" ? "10:00" : "", repeat };
  }
  const start = zonedParts(occ.startsAt!, viewerZone);
  const end = occ.endsAt ? zonedParts(occ.endsAt, viewerZone) : null;
  return {
    ...base,
    dated: true,
    allDay: false,
    date: start.date,
    endDate: end?.date ?? start.date,
    startTime: start.time,
    endTime: end?.time ?? "",
    repeat,
  };
}

export type ItemFields = Pick<
  AgendaItem,
  | "kind"
  | "title"
  | "note"
  | "all_day"
  | "starts_at"
  | "ends_at"
  | "start_date"
  | "end_date"
  | "time_zone"
  | "recurrence"
  | "keep_missed"
  | "reminder_minutes"
>;

/** Why the draft can't be saved yet, or null. */
export function draftProblem(draft: Draft): string | null {
  if (!draft.title.trim()) return "Give it a title.";
  if (draft.kind === "event" && !draft.dated) return "An event needs a date.";
  if (!draft.dated) return null;
  if (draft.allDay) return draft.endDate < draft.date ? "It can't end before it starts." : null;
  if (draft.kind === "event" && !draft.endTime) return "Give the event an end time.";
  if (draft.endTime && `${draft.endDate}T${draft.endTime}` < `${draft.date}T${draft.startTime}`) return "It can't end before it starts.";
  return null;
}

/**
 * The item fields for a draft. `existing` keeps a rule the form can't show
 * when the repeat choice is "custom".
 */
export function fieldsFromDraft(draft: Draft, timeZone: string, existing?: AgendaItem | null): ItemFields {
  const base = {
    kind: draft.kind,
    title: draft.title.trim(),
    note: draft.note.trim() || null,
    time_zone: timeZone,
    keep_missed: false,
    reminder_minutes: null as number | null,
  };
  if (!draft.dated) {
    return { ...base, all_day: false, starts_at: null, ends_at: null, start_date: null, end_date: null, recurrence: null };
  }
  const recurrence = draft.repeat === "custom" ? (existing?.recurrence ?? null) : buildRecurrence(draft.repeat, draft.date);
  const dated = {
    ...base,
    recurrence,
    keep_missed: draft.kind === "task" && recurrence !== null && draft.keepMissed,
    reminder_minutes: draft.reminder,
  };
  if (draft.allDay) {
    return {
      ...dated,
      all_day: true,
      starts_at: null,
      ends_at: null,
      start_date: draft.date,
      end_date: draft.endDate > draft.date ? draft.endDate : null,
    };
  }
  return {
    ...dated,
    all_day: false,
    starts_at: utcStamp(zonedToUtc(draft.date, draft.startTime, timeZone)),
    ends_at: draft.endTime ? utcStamp(zonedToUtc(draft.endDate, draft.endTime, timeZone)) : null,
    start_date: null,
    end_date: null,
  };
}

/** The assignee ids a draft asks for. */
export const draftAssignees = (draft: Draft, me: string, other: string | null) => assigneeIds(draft.assignee, me, other);

/**
 * Fields for "All of them" when the form was opened on one occurrence: the
 * series keeps its first date, moved by as many days as the occurrence was.
 */
export function seriesFieldsFromOccurrenceDraft(draft: Draft, occ: Occurrence, series: AgendaItem, timeZone: string): ItemFields {
  if (!draft.dated || !occ.date) return fieldsFromDraft(draft, timeZone, series);
  const shift = daysBetween(occ.date, draft.date);
  const seriesStart = series.start_date ?? zonedParts(series.starts_at!, timeZone).date;
  const start = addDays(seriesStart, shift);
  const length = daysBetween(draft.date, draft.endDate);
  const moved = { ...draft, date: start, endDate: addDays(start, length) };
  // The repeat rule was described against the occurrence; rebuild it on the series start.
  return fieldsFromDraft(moved, timeZone, series);
}
