/** How dates, times and reminders read on screen. */

import type { Occurrence } from "./occurrences";
import { addDays, dateParts, zonedParts } from "./time";

const at = (date: string) => new Date(`${date}T12:00:00Z`);

/** "Today", "Tomorrow", "Yesterday", or e.g. "Mon 26 Oct" (with the year if it isn't this year's). */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return shortDay(date, today);
}

/** E.g. "Mon 26 Oct", or "Mon 26 Oct 2027" in another year. */
export function shortDay(date: string, today: string): string {
  const sameYear = dateParts(date).year === dateParts(today).year;
  return at(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

/** E.g. "October 2026". */
export function monthLabel(date: string): string {
  return at(date).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * The time of an occurrence as listed on `day`: "All day", "19:00",
 * "19:00–21:00", or for something spanning days "until 21:00" / "from 19:00".
 */
export function timeLabel(occ: Occurrence, day: string, timeZone: string): string {
  if (occ.allDay || !occ.startsAt) return "All day";
  const start = zonedParts(occ.startsAt, timeZone);
  const end = occ.endsAt ? zonedParts(occ.endsAt, timeZone) : null;
  if (start.date < day) return end && occ.endDate === day ? `until ${end.time}` : "All day";
  if (end && occ.endDate !== start.date) return `from ${start.time}`;
  return end && end.time !== start.time ? `${start.time}–${end.time}` : start.time;
}

/** When an occurrence is, in one line, for lists that aren't grouped by day. */
export function whenLabel(occ: Occurrence, today: string, timeZone: string): string | null {
  if (!occ.date) return null;
  const day = dayLabel(occ.date, today);
  if (occ.allDay || !occ.startsAt) {
    return occ.endDate && occ.endDate !== occ.date ? `${day} – ${shortDay(occ.endDate, today)}` : day;
  }
  return `${day}, ${zonedParts(occ.startsAt, timeZone).time}`;
}

/** E.g. "At the time", "30 minutes before", "1 day before". */
export function reminderLabel(minutes: number | null): string {
  if (minutes === null) return "No reminder";
  if (minutes === 0) return "At the time";
  const { amount, unit } = reminderParts(minutes);
  return `${amount} ${unit}${amount === 1 ? "" : "s"} before`;
}

export type ReminderUnit = "minute" | "hour" | "day";

/** A reminder in the largest unit that divides it exactly. */
export function reminderParts(minutes: number): { amount: number; unit: ReminderUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: "day" };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: "hour" };
  return { amount: minutes, unit: "minute" };
}

export const UNIT_MINUTES: Record<ReminderUnit, number> = { minute: 1, hour: 60, day: 1440 };
