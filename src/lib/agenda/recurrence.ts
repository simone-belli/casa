/**
 * Google-style recurrence (RFC 5545 RRULE and EXDATE lines): parsing,
 * expanding into local dates, describing, and building from the form.
 */

import { addDays, dateParts, daysInMonth, makeDate, startOfWeek, utcStamp, weekday, zonedParts, zonedToUtc } from "./time";

export const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type Freq = (typeof FREQS)[number];

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** A weekday (0 = Sunday), optionally the nth in the month or year (-1 = last). */
export type ByDay = { weekday: number; nth?: number };

export type Rule = {
  freq: Freq;
  interval: number;
  byDay: ByDay[];
  byMonthDay: number[];
  byMonth: number[];
  count?: number;
  /** Last allowed start: a local date, or a UTC instant. */
  until?: { date: string } | { instant: string };
  /** Occurrence keys removed by EXDATE lines. */
  exdates: string[];
  /** False when the lines use parts Agenda can't expand (kept untouched). */
  supported: boolean;
};

const SUPPORTED_PARTS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYMONTH", "COUNT", "UNTIL", "WKST"]);

/** "20261027" or "20261027T190000[Z]" as a date, or a local or UTC date-time. */
function parseIcalTime(value: string): { date: string; time?: string; utc?: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (!m[4]) return { date };
  return { date, time: `${m[4]}:${m[5]}`, utc: m[7] === "Z" };
}

/**
 * Parses recurrence lines. `timeZone` is the item's, used for local times in
 * EXDATE and UNTIL; `allDay` decides what occurrence keys look like.
 */
export function parseRecurrence(lines: string[] | null, timeZone: string, allDay: boolean): Rule | null {
  if (!lines || lines.length === 0) return null;
  let rule: Rule | null = null;
  const exdates: string[] = [];
  let supported = true;

  for (const raw of lines) {
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon).toUpperCase();
    const body = line.slice(colon + 1);
    const name = head.split(";")[0];

    if (name === "RRULE") {
      if (rule) {
        supported = false;
        continue;
      }
      const parts = Object.fromEntries(
        body.split(";").filter(Boolean).map((p) => {
          const [k, v = ""] = p.split("=");
          return [k.toUpperCase(), v.toUpperCase()];
        }),
      );
      if (Object.keys(parts).some((k) => !SUPPORTED_PARTS.has(k))) supported = false;
      if (parts.WKST && parts.WKST !== "MO") supported = false;
      const freq = parts.FREQ as Freq;
      if (!FREQS.includes(freq)) {
        supported = false;
        continue;
      }
      const byDay: ByDay[] = [];
      for (const d of (parts.BYDAY ?? "").split(",").filter(Boolean)) {
        const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(d);
        if (!m) {
          supported = false;
          continue;
        }
        const nth = m[1] ? Number(m[1]) : undefined;
        if (nth !== undefined && freq !== "MONTHLY" && freq !== "YEARLY") supported = false;
        byDay.push({ weekday: WEEKDAY_CODES.indexOf(m[2] as (typeof WEEKDAY_CODES)[number]), nth });
      }
      const numbers = (v: string | undefined) => (v ?? "").split(",").filter(Boolean).map(Number);
      const byMonthDay = numbers(parts.BYMONTHDAY);
      const byMonth = numbers(parts.BYMONTH);
      if ([...byMonthDay, ...byMonth].some((n) => !Number.isInteger(n) || n === 0)) supported = false;
      if (byDay.some((d) => d.nth !== undefined) && freq === "YEARLY" && byMonth.length === 0) supported = false;

      let until: Rule["until"];
      if (parts.UNTIL) {
        const t = parseIcalTime(parts.UNTIL);
        if (!t) supported = false;
        else if (!t.time) until = { date: t.date };
        else until = { instant: utcStamp(t.utc ? `${t.date}T${t.time}:00Z` : zonedToUtc(t.date, t.time, timeZone)) };
      }
      const interval = parts.INTERVAL ? Number(parts.INTERVAL) : 1;
      const count = parts.COUNT ? Number(parts.COUNT) : undefined;
      if (!Number.isInteger(interval) || interval < 1 || (count !== undefined && (!Number.isInteger(count) || count < 1))) {
        supported = false;
      }
      rule = { freq, interval: Math.max(1, interval || 1), byDay, byMonthDay, byMonth, count, until, exdates, supported: true };
    } else if (name === "EXDATE") {
      const tzid = line
        .slice(0, colon)
        .split(";")
        .find((p) => p.toUpperCase().startsWith("TZID="));
      const zone = tzid ? tzid.slice(5) : timeZone;
      for (const value of body.split(",")) {
        const t = parseIcalTime(value);
        if (!t) continue;
        if (allDay) exdates.push(t.date);
        else if (t.time) exdates.push(utcStamp(t.utc ? `${t.date}T${t.time}:00Z` : zonedToUtc(t.date, t.time, zone)));
      }
    } else {
      // RDATE, EXRULE: not supported.
      supported = false;
    }
  }

  if (!rule) return null;
  rule.exdates = exdates;
  rule.supported = supported;
  return rule;
}

// --- Expanding ------------------------------------------------------------------

/** The dates of a weekday in a month: all of them, or the nth (-1 = last). */
function weekdaysInMonth(year: number, month: number, day: ByDay): number[] {
  const first = makeDate(year, month, 1);
  const offset = (day.weekday - weekday(first) + 7) % 7;
  const all: number[] = [];
  for (let d = 1 + offset; d <= daysInMonth(year, month); d += 7) all.push(d);
  if (day.nth === undefined) return all;
  const picked = day.nth > 0 ? all[day.nth - 1] : all[all.length + day.nth];
  return picked === undefined ? [] : [picked];
}

/** The days of a month that match the rule, given the series' first date. */
function daysOfMonth(rule: Rule, year: number, month: number, start: string): number[] {
  const last = daysInMonth(year, month);
  const days = new Set<number>();
  if (rule.byMonthDay.length > 0) {
    for (const n of rule.byMonthDay) {
      const d = n > 0 ? n : last + 1 + n;
      if (d >= 1 && d <= last) days.add(d);
    }
    if (rule.byDay.length > 0) {
      const allowed = new Set(rule.byDay.map((b) => b.weekday));
      for (const d of [...days]) if (!allowed.has(weekday(makeDate(year, month, d)))) days.delete(d);
    }
  } else if (rule.byDay.length > 0) {
    for (const b of rule.byDay) for (const d of weekdaysInMonth(year, month, b)) days.add(d);
  } else {
    const d = dateParts(start).day;
    if (d <= last) days.add(d);
  }
  return [...days].sort((a, b) => a - b);
}

/**
 * One period of the rule (period 0 contains the series start): the date it
 * begins on, and the dates in it.
 */
function periodDates(rule: Rule, start: string, period: number): { begins: string; dates: string[] } {
  const { year, month } = dateParts(start);
  switch (rule.freq) {
    case "DAILY": {
      const date = addDays(start, period * rule.interval);
      return { begins: date, dates: [date] };
    }
    case "WEEKLY": {
      const monday = addDays(startOfWeek(start), period * rule.interval * 7);
      const days = rule.byDay.length > 0 ? rule.byDay.map((b) => b.weekday) : [weekday(start)];
      return { begins: monday, dates: [...new Set(days)].map((d) => addDays(monday, (d + 6) % 7)).sort() };
    }
    case "MONTHLY": {
      const index = year * 12 + (month - 1) + period * rule.interval;
      const y = Math.floor(index / 12);
      const m = (index % 12) + 1;
      return { begins: makeDate(y, m, 1), dates: daysOfMonth(rule, y, m, start).map((d) => makeDate(y, m, d)) };
    }
    case "YEARLY": {
      const y = year + period * rule.interval;
      const months = rule.byMonth.length > 0 ? [...rule.byMonth].sort((a, b) => a - b) : [month];
      return { begins: makeDate(y, 1, 1), dates: months.flatMap((m) => daysOfMonth(rule, y, m, start).map((d) => makeDate(y, m, d))) };
    }
  }
}

function matchesFilters(rule: Rule, date: string): boolean {
  if (rule.byMonth.length > 0 && rule.freq !== "YEARLY" && !rule.byMonth.includes(dateParts(date).month)) return false;
  if (rule.freq === "DAILY" && rule.byDay.length > 0 && !rule.byDay.some((b) => b.weekday === weekday(date))) return false;
  if (rule.freq === "DAILY" && rule.byMonthDay.length > 0) {
    const { year, month, day } = dateParts(date);
    const last = daysInMonth(year, month);
    if (!rule.byMonthDay.some((n) => (n > 0 ? n : last + 1 + n) === day)) return false;
  }
  return true;
}

/** Safety limit on how many periods are walked through for one expansion. */
const MAX_PERIODS = 20_000;

/**
 * The local dates on which a series starts, up to and including `to`, in
 * order. `time` and `timeZone` (timed series) are needed to apply a UTC
 * UNTIL. The series start always counts as the first occurrence. EXDATEs are
 * not removed here (see occurrences).
 */
export function expandDates(
  rule: Rule,
  start: string,
  to: string,
  timed?: { time: string; timeZone: string },
): string[] {
  const dates: string[] = [];
  let produced = 0;
  const beyondUntil = (date: string) => {
    if (!rule.until) return false;
    if ("date" in rule.until) return date > rule.until.date;
    const instant = timed ? zonedToUtc(date, timed.time, timed.timeZone) : zonedToUtc(date, "00:00", "UTC");
    return utcStamp(instant) > rule.until.instant;
  };

  if (start > to || beyondUntil(start)) return dates;
  dates.push(start);
  produced++;

  for (let period = 0; period < MAX_PERIODS; period++) {
    const { begins, dates: candidates } = periodDates(rule, start, period);
    if (begins > to) break;
    for (const date of candidates) {
      if (date <= start || !matchesFilters(rule, date)) continue;
      if (date > to || beyondUntil(date)) return dates;
      if (rule.count !== undefined && produced >= rule.count) return dates;
      produced++;
      dates.push(date);
    }
  }
  return dates;
}

// --- Occurrence keys ---------------------------------------------------------------

/** The key of an occurrence: its date (all-day series) or UTC start. */
export function occurrenceKey(date: string, timed?: { time: string; timeZone: string }): string {
  return timed ? utcStamp(zonedToUtc(date, timed.time, timed.timeZone)) : date;
}

// --- The form's choices ---------------------------------------------------------------

export type RepeatChoice = {
  freq: "none" | "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** Weekly: the weekdays (0 = Sunday); empty means the start's weekday. */
  weekdays: number[];
  /** Monthly: on the same day number, or the same weekday (e.g. 2nd Tuesday). */
  monthlyBy: "day" | "weekday";
  /** Last date, inclusive; null repeats forever. */
  until: string | null;
};

export const NO_REPEAT: RepeatChoice = { freq: "none", interval: 1, weekdays: [], monthlyBy: "day", until: null };

/** Which week of the month a date falls in: 1–4, or -1 for the last one. */
function nthInMonth(date: string): number {
  const { year, month, day } = dateParts(date);
  if (day + 7 > daysInMonth(year, month)) return -1;
  return Math.ceil(day / 7);
}

/** Recurrence lines for a choice; `start` is the item's first date. */
export function buildRecurrence(choice: RepeatChoice, start: string): string[] | null {
  if (choice.freq === "none") return null;
  const parts = [`FREQ=${choice.freq.toUpperCase()}`];
  if (choice.interval > 1) parts.push(`INTERVAL=${choice.interval}`);
  if (choice.freq === "weekly" && choice.weekdays.length > 0) {
    parts.push(`BYDAY=${[...new Set(choice.weekdays)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_CODES[d]).join(",")}`);
  }
  if (choice.freq === "monthly" && choice.monthlyBy === "weekday") {
    parts.push(`BYDAY=${nthInMonth(start)}${WEEKDAY_CODES[weekday(start)]}`);
  }
  if (choice.until) parts.push(`UNTIL=${choice.until.replaceAll("-", "")}`);
  return [`RRULE:${parts.join(";")}`];
}

/** The form's choice for existing lines, or "custom" if the form can't show them. */
export function repeatChoiceOf(lines: string[] | null, start: string): RepeatChoice | "custom" {
  const rule = parseRecurrence(lines, "UTC", true);
  if (!rule) return NO_REPEAT;
  if (!rule.supported || rule.count !== undefined || rule.byMonth.length > 0 || rule.exdates.length > 0) return "custom";
  const until = rule.until ? ("date" in rule.until ? rule.until.date : rule.until.instant.slice(0, 10)) : null;
  const base = { ...NO_REPEAT, interval: rule.interval, until };
  switch (rule.freq) {
    case "DAILY":
      return rule.byDay.length || rule.byMonthDay.length ? "custom" : { ...base, freq: "daily" };
    case "WEEKLY":
      if (rule.byMonthDay.length || rule.byDay.some((b) => b.nth !== undefined)) return "custom";
      return { ...base, freq: "weekly", weekdays: rule.byDay.map((b) => b.weekday) };
    case "MONTHLY": {
      if (rule.byDay.length === 0 && rule.byMonthDay.length === 0) return { ...base, freq: "monthly" };
      const [b] = rule.byDay;
      if (rule.byMonthDay.length === 0 && rule.byDay.length === 1 && b.nth === nthInMonth(start) && b.weekday === weekday(start)) {
        return { ...base, freq: "monthly", monthlyBy: "weekday" };
      }
      return "custom";
    }
    case "YEARLY":
      return rule.byDay.length || rule.byMonthDay.length ? "custom" : { ...base, freq: "yearly" };
  }
}

// --- Describing ---------------------------------------------------------------------

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", [-1]: "last" };

function ordinalDay(n: number): string {
  if (n < 0) return n === -1 ? "last day" : `${-n}${suffix(-n)} to last day`;
  return `${n}${suffix(n)}`;
}

function suffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}

const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** E.g. "Every Tuesday", "Every 2 weeks on Monday and Thursday", "Every month on the last Friday". */
export function describeRecurrence(lines: string[] | null, start: string | null): string | null {
  const rule = parseRecurrence(lines, "UTC", true);
  if (!rule) return null;
  if (!rule.supported) return "Repeats (custom rule)";
  const every = (unit: string) => (rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`);
  const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
  let text: string;

  switch (rule.freq) {
    case "DAILY": {
      const days = rule.byDay.map((b) => b.weekday).sort();
      text = days.join() === "1,2,3,4,5" ? "Every weekday" : every("day");
      break;
    }
    case "WEEKLY": {
      const days = (rule.byDay.length > 0 ? rule.byDay.map((b) => b.weekday) : start ? [weekday(start)] : [])
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_NAMES[d]);
      if (days.length === 5 && !days.includes("Saturday") && !days.includes("Sunday") && rule.interval === 1) text = "Every weekday";
      else if (rule.interval === 1 && days.length === 1) text = `Every ${days[0]}`;
      else text = `${every("week")}${days.length ? ` on ${list(days)}` : ""}`;
      break;
    }
    case "MONTHLY": {
      if (rule.byDay.length > 0 && rule.byMonthDay.length === 0) {
        text = `${every("month")} on the ${list(rule.byDay.map((b) => `${b.nth !== undefined ? `${ORDINALS[b.nth] ?? `${b.nth}th`} ` : "every "}${WEEKDAY_NAMES[b.weekday]}`))}`;
      } else {
        const days = rule.byMonthDay.length > 0 ? rule.byMonthDay : start ? [dateParts(start).day] : [];
        text = `${every("month")}${days.length ? ` on the ${list(days.map(ordinalDay))}` : ""}`;
      }
      break;
    }
    case "YEARLY":
      text = every("year");
      break;
  }
  if (rule.count !== undefined) text += `, ${rule.count} times`;
  if (rule.until) text += ` until ${shortDate("date" in rule.until ? rule.until.date : zonedParts(rule.until.instant, "UTC").date)}`;
  return text;
}
