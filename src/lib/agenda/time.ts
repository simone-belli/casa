/**
 * Calendar dates (YYYY-MM-DD strings) and conversions between UTC instants
 * and local times in a named time zone. Dates are handled as plain calendar
 * days so recurring items keep their local time across daylight saving
 * changes.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDate(value: string): boolean {
  return DATE_RE.test(value);
}

function toUtcDay(date: string): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Not a date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dateParts(date: string): { year: number; month: number; day: number } {
  const d = new Date(toUtcDay(date));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function makeDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  return fromUtcDay(toUtcDay(date) + days * 86_400_000);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcDay(b) - toUtcDay(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(toUtcDay(date)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The first day of the date's month. */
export function startOfMonth(date: string): string {
  const { year, month } = dateParts(date);
  return makeDate(year, month, 1);
}

export function addMonths(date: string, months: number): string {
  const { year, month, day } = dateParts(date);
  const index = year * 12 + (month - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** The Monday on or before the date. */
export function startOfWeek(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

// --- Time zones ---------------------------------------------------------------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The phone's time zone. */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** The local date and time (HH:MM) of an instant in a time zone. */
export function zonedParts(instant: Date | string, timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(typeof instant === "string" ? new Date(instant) : instant)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** How far the time zone is ahead of UTC at an instant, in ms. */
function offsetAt(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The UTC instant of a local date and time (HH:MM) in a time zone. A time
 * skipped by a daylight saving change moves forward by the gap; an ambiguous
 * time picks the earlier instant.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(":").map(Number);
  const local = toUtcDay(date) + (h * 60 + m) * 60_000;
  // The offsets just before and after any change near this time.
  const before = offsetAt(local - 6 * 3_600_000, timeZone);
  const after = offsetAt(local + 6 * 3_600_000, timeZone);
  const valid = [local - before, local - after].filter((t) => t + offsetAt(t, timeZone) === local);
  return new Date(valid.length > 0 ? Math.min(...valid) : local - before);
}

/** Today's date in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return zonedParts(now, timeZone).date;
}

/** An instant as UTC YYYY-MM-DDTHH:MM:SSZ (no milliseconds). */
export function utcStamp(instant: Date | string): string {
  return new Date(instant).toISOString().replace(/\.\d{3}Z$/, "Z");
}
