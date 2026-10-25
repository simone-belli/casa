/** What the Calendar and Tasks views show, worked out from the raw rows. */

import {
  compareOccurrences,
  exceptionsBySeries,
  isDated,
  occurrencesBetween,
  seriesOccurrences,
  singleOccurrence,
  type Occurrence,
} from "./occurrences";
import { addDays, daysBetween, weekday, zonedParts } from "./time";
import type { Agenda, AgendaItem, AgendaSettings, Proposal } from "./types";

/** Who's looking, and the other household member. */
export type Viewer = { me: string; other: string | null; timeZone: string; today: string };

export const pendingProposal = (proposals: Proposal[], itemId: string) =>
  proposals.find((p) => p.item_id === itemId && p.status === "pending") ?? null;

/** The latest proposal for an item, if it was declined and the proposer hasn't seen it yet. */
export function unseenDecline(proposals: Proposal[], itemId: string, me: string): Proposal | null {
  const latest = proposals
    .filter((p) => p.item_id === itemId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))[0];
  return latest && latest.status === "declined" && latest.proposed_by === me && !latest.acknowledged_at ? latest : null;
}

/** The item that carries assignment and proposals: the series for an occurrence. */
export const owner = (occ: Occurrence) => occ.series ?? occ.item;

// --- Overdue ------------------------------------------------------------------

/** The local date the series was created, in the viewer's zone. */
const createdOn = (item: AgendaItem, viewer: Viewer) => zonedParts(item.created_at, viewer.timeZone).date;

/**
 * The open task occurrences that are overdue: dated before today. A one-off
 * task stays overdue until it's done or moved. For a series, only those that
 * keep missed occurrences, and only since the series was added.
 */
export function overdueTasks(items: AgendaItem[], viewer: Viewer): Occurrence[] {
  const yesterday = addDays(viewer.today, -1);
  const exceptions = exceptionsBySeries(items);
  const result: Occurrence[] = [];
  for (const item of items) {
    if (item.kind !== "task" || item.recurring_item_id || !isDated(item)) continue;
    if (!item.recurrence) {
      const occ = singleOccurrence(item, viewer.timeZone);
      if (!occ.done && occ.date && occ.date < viewer.today) result.push(occ);
      continue;
    }
    if (!item.keep_missed) continue;
    const since = createdOn(item, viewer);
    for (const occ of seriesOccurrences(item, exceptions.get(item.id), yesterday, viewer.timeZone)) {
      if (!occ.done && occ.date && occ.date < viewer.today && occ.date >= since) result.push(occ);
    }
  }
  return result.sort(compareOccurrences);
}

/** Expanding further ahead for a series that has nothing coming up soon. */
const LOOKAHEAD_DAYS = [62, 800, 4000];

/** A series' next open occurrence on or after today, if any. */
export function nextOpenOccurrence(series: AgendaItem, items: AgendaItem[], viewer: Viewer): Occurrence | null {
  const exceptions = exceptionsBySeries(items).get(series.id);
  for (const days of LOOKAHEAD_DAYS) {
    const list = seriesOccurrences(series, exceptions, addDays(viewer.today, days), viewer.timeZone);
    const next = list.find((o) => !o.done && o.date !== null && o.date >= viewer.today);
    if (next) return next;
  }
  return null;
}

// --- Tasks view ----------------------------------------------------------------

export type TaskEntry = {
  occ: Occurrence;
  overdue: boolean;
  /** A proposal I made that's waiting for the other person. */
  waitingFor: Proposal | null;
  /** My proposal was declined and I haven't acknowledged it. */
  declined: Proposal | null;
};

export type TaskSections = {
  /** Proposals made to me. */
  waiting: TaskEntry[];
  /** Open tasks that are unassigned. */
  undecided: TaskEntry[];
  mine: TaskEntry[];
  theirs: TaskEntry[];
  both: TaskEntry[];
  /** Done tasks and ticked-off occurrences, most recent first. */
  done: Occurrence[];
};

/** Which assignee section an assignment belongs in. */
export function assigneeGroup(assignees: string[], viewer: Viewer): "undecided" | "mine" | "theirs" | "both" {
  if (assignees.length === 0) return "undecided";
  const hasMe = assignees.includes(viewer.me);
  const hasOther = assignees.some((a) => a !== viewer.me);
  if (hasMe && hasOther) return "both";
  return hasMe ? "mine" : "theirs";
}

/** The open occurrences of each task that the Tasks view lists. */
function openTaskOccurrences(items: AgendaItem[], viewer: Viewer): Occurrence[] {
  const overdue = overdueTasks(items, viewer);
  const result: Occurrence[] = [];
  for (const item of items) {
    if (item.kind !== "task" || item.recurring_item_id) continue;
    if (item.recurrence && isDated(item)) {
      result.push(...overdue.filter((o) => o.series?.id === item.id));
      const next = nextOpenOccurrence(item, items, viewer);
      if (next) result.push(next);
    } else if (item.task_status !== "done") {
      result.push(singleOccurrence(item, viewer.timeZone));
    }
  }
  return result;
}

export function taskSections(agenda: Agenda, viewer: Viewer): TaskSections {
  const sections: TaskSections = { waiting: [], undecided: [], mine: [], theirs: [], both: [], done: [] };
  for (const occ of openTaskOccurrences(agenda.items, viewer)) {
    const item = owner(occ);
    const pending = pendingProposal(agenda.proposals, item.id);
    const entry: TaskEntry = {
      occ,
      overdue: occ.date !== null && occ.date < viewer.today,
      waitingFor: pending && pending.proposed_by === viewer.me ? pending : null,
      declined: unseenDecline(agenda.proposals, item.id, viewer.me),
    };
    if (pending && pending.proposed_by !== viewer.me) sections.waiting.push(entry);
    else sections[assigneeGroup(item.assignees, viewer)].push(entry);
  }
  for (const key of ["waiting", "undecided", "mine", "theirs", "both"] as const) {
    sections[key].sort((a, b) => compareOccurrences(a.occ, b.occ));
  }

  const byId = new Map(agenda.items.map((i) => [i.id, i]));
  sections.done = agenda.items
    .filter((i) => i.kind === "task" && i.task_status === "done" && !i.cancelled)
    .map((i) => {
      const series = i.recurring_item_id ? (byId.get(i.recurring_item_id) ?? null) : null;
      return singleOccurrence(i, viewer.timeZone, series);
    })
    .sort((a, b) => ((a.item.done_at ?? "") < (b.item.done_at ?? "") ? 1 : -1));
  return sections;
}

// --- Calendar view ----------------------------------------------------------------

export type CalendarFilter = "everyone" | "mine";

/** Whether an item passes the filter: Mine is assigned to me or to both of us. */
export function passesFilter(item: AgendaItem, filter: CalendarFilter, viewer: Viewer): boolean {
  return filter === "everyone" || item.assignees.includes(viewer.me);
}

export type CalendarDay = { date: string; occurrences: Occurrence[] };

/**
 * The day-by-day list from `from` for `days` days: days with something on
 * them, and always the first day (today, or the day jumped to).
 */
export function calendarDays(agenda: Agenda, viewer: Viewer, filter: CalendarFilter, from: string, days: number): CalendarDay[] {
  const to = addDays(from, days - 1);
  const byDate = new Map<string, Occurrence[]>();
  for (const occ of occurrencesBetween(agenda.items, from, to, viewer.timeZone)) {
    if (!passesFilter(owner(occ), filter, viewer)) continue;
    // A multi-day item is listed on each of its days in range.
    for (let d = occ.date! < from ? from : occ.date!; d <= occ.endDate! && d <= to; d = addDays(d, 1)) {
      const list = byDate.get(d) ?? [];
      list.push(occ);
      byDate.set(d, list);
    }
  }
  if (!byDate.has(from)) byDate.set(from, []);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, occurrences]) => ({ date, occurrences }));
}

/** The overdue tasks shown at the top of the calendar, filtered. */
export function calendarOverdue(agenda: Agenda, viewer: Viewer, filter: CalendarFilter): Occurrence[] {
  return overdueTasks(agenda.items, viewer).filter((o) => passesFilter(owner(o), filter, viewer));
}

/** How many items are on each day of a month grid (for its dots). */
export function busyDays(agenda: Agenda, viewer: Viewer, filter: CalendarFilter, from: string, to: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const day of calendarDays(agenda, viewer, filter, from, daysBetween(from, to) + 1)) {
    if (day.occurrences.length > 0) counts.set(day.date, day.occurrences.length);
  }
  return counts;
}

// --- Nudge ----------------------------------------------------------------------

/** What the nudge banner lists today, or null if it isn't shown. */
export function nudge(
  sections: TaskSections,
  settings: Pick<AgendaSettings, "nudge_enabled" | "nudge_weekday" | "nudge_dismissed_on">,
  today: string,
): { undecided: number; waiting: number } | null {
  if (!settings.nudge_enabled || weekday(today) !== settings.nudge_weekday) return null;
  if (settings.nudge_dismissed_on === today) return null;
  const counts = { undecided: sections.undecided.length, waiting: sections.waiting.length };
  return counts.undecided + counts.waiting > 0 ? counts : null;
}
