/**
 * Mapping between Agenda items and Google Calendar events, both ways. No
 * network calls here: see src/lib/google for those.
 */

import { addDays, utcStamp } from "./time";
import type { AgendaItem, Proposal } from "./types";

/** The parts of a Google Calendar event Agenda reads. */
export type GoogleTime = { date?: string | null; dateTime?: string | null; timeZone?: string | null };

export type GoogleEvent = {
  id: string;
  etag?: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  start?: GoogleTime;
  end?: GoogleTime;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleTime;
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
  updated?: string;
};

/** What Agenda writes to Google for an item (sent as a patch, so nulls clear fields). */
export type EventBody = {
  status: "confirmed" | "cancelled";
  summary?: string;
  description?: string;
  start?: GoogleTime;
  end?: GoogleTime;
  recurrence?: string[];
  reminders?: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
  extendedProperties?: { private: { agendaItemId: string } };
};

export const OPEN_PREFIX = "☐ ";
export const DONE_PREFIX = "☑ ";

/** The Google event id Agenda picks for a new event (Google allows lower-case hex). */
export const eventIdFor = (itemId: string) => itemId.replaceAll("-", "").toLowerCase();

/** The id of one occurrence of a Google series, e.g. abc_20261027T180000Z or abc_20261027. */
export function instanceId(seriesEventId: string, occurrence: string): string {
  return `${seriesEventId}_${occurrence.replace(/[-:]/g, "")}`;
}

/** Whether an event id names one occurrence of a series. */
export const isInstanceId = (id: string) => /_\d{8}(T\d{6}Z)?$/.test(id);

/** The "Assigned: Kat" (or "Proposed to Kat") line written into the description. */
export function assignedLine(item: AgendaItem, pending: Proposal | null, nameOf: (id: string) => string | null): string {
  const label = (ids: string[]) => {
    if (ids.length === 0) return "Unassigned";
    if (ids.length > 1) return "Both";
    return nameOf(ids[0]) ?? "Unassigned";
  };
  if (pending) {
    return pending.proposed_assignees.length > 1 ? "Proposed to both" : `Proposed to ${label(pending.proposed_assignees)}`;
  }
  return `Assigned: ${label(item.assignees)}`;
}

/**
 * The Google event for an item. `line` is its assignedLine (worked out from
 * the series, for an occurrence); an occurrence never sends a recurrence.
 */
export function eventBody(item: AgendaItem, line: string): EventBody {
  if (item.cancelled) return { status: "cancelled" };
  const summary = item.kind === "task" ? `${item.task_status === "done" ? DONE_PREFIX : OPEN_PREFIX}${item.title}` : item.title;
  const description = item.note ? `${item.note}\n\n${line}` : line;

  let start: GoogleTime;
  let end: GoogleTime;
  if (item.all_day && item.start_date) {
    start = { date: item.start_date, dateTime: null, timeZone: null };
    end = { date: addDays(item.end_date ?? item.start_date, 1), dateTime: null, timeZone: null };
  } else {
    start = { date: null, dateTime: item.starts_at, timeZone: item.time_zone };
    end = { date: null, dateTime: item.ends_at ?? item.starts_at, timeZone: item.time_zone };
  }

  const body: EventBody = {
    status: "confirmed",
    summary,
    description,
    start,
    end,
    reminders: {
      useDefault: false,
      overrides: item.reminder_minutes === null ? [] : [{ method: "popup", minutes: item.reminder_minutes }],
    },
    extendedProperties: { private: { agendaItemId: item.id } },
  };
  if (!item.recurring_item_id) body.recurrence = item.recurrence ?? [];
  return body;
}

// --- Reading Google events ------------------------------------------------------

/** The title without Agenda's tick-box prefix, and whether the box was ticked. */
export function readSummary(summary: string | undefined): { title: string; done: boolean | null } {
  const text = (summary ?? "").trim();
  for (const [prefix, done] of [
    [OPEN_PREFIX.trim(), false],
    [DONE_PREFIX.trim(), true],
  ] as const) {
    if (text.startsWith(prefix)) return { title: text.slice(prefix.length).trim() || "Untitled", done };
  }
  return { title: text || "Untitled", done: null };
}

/** The description without Agenda's own "Assigned:" line, or null if nothing is left. */
export function readDescription(description: string | undefined): string | null {
  const text = (description ?? "")
    // Google's own editor may turn line breaks into <br>.
    .replace(/<br\s*\/?>/gi, "\n")
    .split("\n")
    .filter((line) => !/^\s*(Assigned: |Proposed to )/.test(line.replace(/<[^>]+>/g, "")))
    .join("\n")
    .trim();
  return text || null;
}

/** An occurrence key (see occurrenceKey) from Google's originalStartTime. */
export function occurrenceFromGoogle(time: GoogleTime | undefined): string | null {
  if (time?.date) return time.date;
  if (time?.dateTime) return utcStamp(time.dateTime);
  return null;
}

export type FieldsFromGoogle = Pick<
  AgendaItem,
  "title" | "note" | "all_day" | "starts_at" | "ends_at" | "start_date" | "end_date" | "time_zone" | "recurrence" | "reminder_minutes"
> & { done: boolean | null };

/** The item fields an event carries. Null if it has no usable start. */
export function fieldsFromEvent(event: GoogleEvent, calendarZone: string): FieldsFromGoogle | null {
  const { title, done } = readSummary(event.summary);
  const reminder = event.reminders && !event.reminders.useDefault ? (event.reminders.overrides?.[0]?.minutes ?? null) : null;
  const base = {
    title,
    done,
    note: readDescription(event.description),
    recurrence: event.recurrence && event.recurrence.length > 0 ? event.recurrence : null,
    reminder_minutes: reminder,
    time_zone: event.start?.timeZone || calendarZone,
  };
  if (event.start?.date) {
    const lastDay = event.end?.date ? addDays(event.end.date, -1) : event.start.date;
    return {
      ...base,
      all_day: true,
      start_date: event.start.date,
      end_date: lastDay > event.start.date ? lastDay : null,
      starts_at: null,
      ends_at: null,
    };
  }
  if (event.start?.dateTime) {
    const startsAt = utcStamp(event.start.dateTime);
    const endsAt = event.end?.dateTime ? utcStamp(event.end.dateTime) : null;
    return {
      ...base,
      all_day: false,
      start_date: null,
      end_date: null,
      starts_at: startsAt,
      ends_at: endsAt && endsAt >= startsAt ? endsAt : null,
    };
  }
  return null;
}
