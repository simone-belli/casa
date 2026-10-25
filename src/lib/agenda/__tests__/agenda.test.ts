import { describe, expect, it } from "vitest";
import { assigneeChoice, assigneeIds, planAssignment } from "../assign";
import { occurrencesBetween, seriesOccurrences } from "../occurrences";
import { buildRecurrence, describeRecurrence, expandDates, parseRecurrence, repeatChoiceOf, NO_REPEAT } from "../recurrence";
import { addMonths, startOfWeek, weekday, zonedParts, zonedToUtc } from "../time";
import type { AgendaItem, Proposal } from "../types";
import { calendarDays, nudge, overdueTasks, taskSections, type Viewer } from "../views";

const SIMONE = "simone";
const KAT = "kat";
const ROME = "Europe/Rome";

const item = (fields: Partial<AgendaItem> & { id: string }): AgendaItem => ({
  kind: "task",
  title: fields.id,
  note: null,
  all_day: false,
  starts_at: null,
  ends_at: null,
  start_date: null,
  end_date: null,
  time_zone: ROME,
  recurrence: null,
  keep_missed: false,
  recurring_item_id: null,
  original_start: null,
  cancelled: false,
  assignees: [],
  task_status: fields.kind === "event" ? null : "open",
  done_at: null,
  done_by: null,
  reminder_minutes: null,
  created_by: SIMONE,
  updated_by: SIMONE,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
  ...fields,
});

const proposal = (fields: Partial<Proposal> & { item_id: string }): Proposal => ({
  id: `p-${fields.item_id}`,
  proposed_by: SIMONE,
  proposed_assignees: [KAT],
  status: "pending",
  answered_by: null,
  answered_at: null,
  acknowledged_at: null,
  created_at: "2026-10-02T08:00:00Z",
  ...fields,
});

// Sunday 25 October 2026 is the day daylight saving ends in Rome.
const viewer: Viewer = { me: SIMONE, other: KAT, timeZone: ROME, today: "2026-10-25" };

describe("time", () => {
  it("converts local times across daylight saving changes", () => {
    expect(zonedToUtc("2026-10-24", "19:00", ROME).toISOString()).toBe("2026-10-24T17:00:00.000Z");
    expect(zonedToUtc("2026-10-26", "19:00", ROME).toISOString()).toBe("2026-10-26T18:00:00.000Z");
    // 02:30 doesn't exist on 29 March 2026 in Rome; it moves forward.
    expect(zonedToUtc("2026-03-29", "02:30", ROME).toISOString()).toBe("2026-03-29T01:30:00.000Z");
    // 02:30 happens twice on 25 October; the earlier one is picked.
    expect(zonedToUtc("2026-10-25", "02:30", ROME).toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(zonedParts("2026-10-26T18:00:00Z", ROME)).toEqual({ date: "2026-10-26", time: "19:00" });
  });

  it("does calendar arithmetic", () => {
    expect(weekday("2026-10-25")).toBe(0);
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 2)).toBe("2027-01-15");
  });
});

describe("recurrence", () => {
  const dates = (lines: string[], start: string, to: string) => expandDates(parseRecurrence(lines, ROME, true)!, start, to);

  it("expands weekly rules", () => {
    expect(dates(["RRULE:FREQ=WEEKLY;BYDAY=TU"], "2026-10-06", "2026-10-31")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(dates(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH"], "2026-10-05", "2026-10-31")).toEqual([
      "2026-10-05",
      "2026-10-08",
      "2026-10-19",
      "2026-10-22",
    ]);
  });

  it("always counts the series start, even off the rule", () => {
    expect(dates(["RRULE:FREQ=WEEKLY;BYDAY=MO"], "2026-10-07", "2026-10-20")).toEqual(["2026-10-07", "2026-10-12", "2026-10-19"]);
  });

  it("expands monthly and yearly rules", () => {
    expect(dates(["RRULE:FREQ=MONTHLY"], "2026-01-31", "2026-05-31")).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
    expect(dates(["RRULE:FREQ=MONTHLY;BYDAY=-1FR"], "2026-10-30", "2027-01-31")).toEqual([
      "2026-10-30",
      "2026-11-27",
      "2026-12-25",
      "2027-01-29",
    ]);
    expect(dates(["RRULE:FREQ=MONTHLY;BYMONTHDAY=-1"], "2026-01-31", "2026-03-31")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(dates(["RRULE:FREQ=YEARLY"], "2024-02-29", "2028-12-31")).toEqual(["2024-02-29", "2028-02-29"]);
  });

  it("stops at COUNT and UNTIL", () => {
    expect(dates(["RRULE:FREQ=DAILY;COUNT=3"], "2026-10-01", "2026-12-31")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(dates(["RRULE:FREQ=DAILY;UNTIL=20261003"], "2026-10-01", "2026-12-31")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    const rule = parseRecurrence(["RRULE:FREQ=DAILY;UNTIL=20261002T170000Z"], ROME, false)!;
    expect(expandDates(rule, "2026-10-01", "2026-10-31", { time: "19:00", timeZone: ROME })).toEqual(["2026-10-01", "2026-10-02"]);
    expect(expandDates(rule, "2026-10-01", "2026-10-31", { time: "19:30", timeZone: ROME })).toEqual(["2026-10-01"]);
  });

  it("filters daily rules by weekday", () => {
    expect(dates(["RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR"], "2026-10-23", "2026-10-27")).toEqual(["2026-10-23", "2026-10-26", "2026-10-27"]);
  });

  it("reads EXDATEs and flags rules it can't expand", () => {
    const timed = parseRecurrence(["RRULE:FREQ=WEEKLY", "EXDATE;TZID=Europe/Rome:20261027T190000"], ROME, false)!;
    expect(timed.exdates).toEqual(["2026-10-27T18:00:00Z"]);
    expect(timed.supported).toBe(true);
    expect(parseRecurrence(["RRULE:FREQ=MONTHLY;BYSETPOS=-1;BYDAY=MO,TU,WE,TH,FR"], ROME, true)!.supported).toBe(false);
    expect(parseRecurrence(["RRULE:FREQ=HOURLY"], ROME, true)).toBeNull();
  });

  it("builds and reads back the form's choices", () => {
    const weekly = { ...NO_REPEAT, freq: "weekly" as const, weekdays: [4, 1] };
    expect(buildRecurrence(weekly, "2026-10-05")).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO,TH"]);
    expect(repeatChoiceOf(buildRecurrence(weekly, "2026-10-05"), "2026-10-05")).toEqual({ ...weekly, weekdays: [1, 4] });

    const lastFriday = { ...NO_REPEAT, freq: "monthly" as const, monthlyBy: "weekday" as const, until: "2027-06-30" };
    expect(buildRecurrence(lastFriday, "2026-10-30")).toEqual(["RRULE:FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20270630"]);
    expect(repeatChoiceOf(buildRecurrence(lastFriday, "2026-10-30"), "2026-10-30")).toEqual(lastFriday);

    expect(buildRecurrence(NO_REPEAT, "2026-10-30")).toBeNull();
    expect(repeatChoiceOf(["RRULE:FREQ=DAILY;COUNT=5"], "2026-10-30")).toBe("custom");
  });

  it("describes rules", () => {
    expect(describeRecurrence(["RRULE:FREQ=WEEKLY;BYDAY=TU"], "2026-10-06")).toBe("Every Tuesday");
    expect(describeRecurrence(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH,MO"], "2026-10-05")).toBe("Every 2 weeks on Monday and Thursday");
    expect(describeRecurrence(["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"], "2026-10-05")).toBe("Every weekday");
    expect(describeRecurrence(["RRULE:FREQ=MONTHLY;BYDAY=-1FR"], "2026-10-30")).toBe("Every month on the last Friday");
    expect(describeRecurrence(["RRULE:FREQ=MONTHLY"], "2026-10-03")).toBe("Every month on the 3rd");
    expect(describeRecurrence(["RRULE:FREQ=YEARLY;UNTIL=20301231"], "2026-10-03")).toBe("Every year until 31 Dec 2030");
  });
});

describe("occurrences", () => {
  const bins = item({
    id: "bins",
    starts_at: "2026-10-06T18:00:00Z", // Tuesday 20:00 in Rome (summer time)
    recurrence: ["RRULE:FREQ=WEEKLY"],
  });

  it("keeps the local time of a series across daylight saving", () => {
    const list = seriesOccurrences(bins, undefined, "2026-11-03", ROME);
    expect(list.map((o) => o.startsAt)).toEqual([
      "2026-10-06T18:00:00Z",
      "2026-10-13T18:00:00Z",
      "2026-10-20T18:00:00Z",
      "2026-10-27T19:00:00Z",
      "2026-11-03T19:00:00Z",
    ]);
    expect(list[3].occurrence).toBe("2026-10-27T19:00:00Z");
  });

  it("applies changed, ticked-off and cancelled occurrences", () => {
    const moved = item({
      id: "moved",
      recurring_item_id: "bins",
      original_start: "2026-10-13T18:00:00Z",
      starts_at: "2026-10-14T18:00:00Z",
    });
    const cancelled = item({ id: "cancelled", recurring_item_id: "bins", original_start: "2026-10-20T18:00:00Z", starts_at: "2026-10-20T18:00:00Z", cancelled: true });
    const list = occurrencesBetween([bins, moved, cancelled], "2026-10-01", "2026-10-28", ROME);
    expect(list.map((o) => o.date)).toEqual(["2026-10-06", "2026-10-14", "2026-10-27"]);
    expect(list[1].exception?.id).toBe("moved");
    expect(list[1].series?.id).toBe("bins");
  });

  it("lists multi-day and all-day items on each of their days", () => {
    const trip = item({ id: "trip", kind: "event", task_status: null, all_day: true, start_date: "2026-10-30", end_date: "2026-11-01" });
    const party = item({ id: "party", kind: "event", task_status: null, starts_at: "2026-10-31T18:00:00Z", ends_at: "2026-10-31T23:00:00Z" });
    const days = calendarDays({ items: [trip, party], proposals: [] }, viewer, "everyone", "2026-10-25", 14);
    expect(days.map((d) => [d.date, d.occurrences.map((o) => o.item.id)])).toEqual([
      ["2026-10-25", []],
      ["2026-10-30", ["trip"]],
      ["2026-10-31", ["trip", "party"]],
      ["2026-11-01", ["trip"]],
    ]);
  });

  it("ends a timed item at midnight on the day before", () => {
    const late = item({ id: "late", kind: "event", task_status: null, starts_at: "2026-10-30T20:00:00Z", ends_at: "2026-10-30T23:00:00Z" });
    const [occ] = occurrencesBetween([late], "2026-10-25", "2026-11-05", ROME);
    expect([occ.date, occ.endDate]).toEqual(["2026-10-30", "2026-10-30"]);
  });
});

describe("overdue", () => {
  it("keeps one-off tasks overdue until done", () => {
    const boiler = item({ id: "boiler", all_day: true, start_date: "2026-10-20" });
    const done = item({ id: "done", all_day: true, start_date: "2026-10-20", task_status: "done" });
    const today = item({ id: "today", all_day: true, start_date: "2026-10-25" });
    expect(overdueTasks([boiler, done, today], viewer).map((o) => o.item.id)).toEqual(["boiler"]);
  });

  it("skips missed occurrences unless the series keeps them, and only since it was added", () => {
    const series = {
      id: "plants",
      all_day: true,
      start_date: "2026-09-01",
      recurrence: ["RRULE:FREQ=WEEKLY"],
      created_at: "2026-10-10T08:00:00Z",
    };
    expect(overdueTasks([item(series)], viewer)).toEqual([]);
    const kept = item({ ...series, keep_missed: true });
    const ticked = item({ id: "tick", recurring_item_id: "plants", original_start: "2026-10-13", all_day: true, start_date: "2026-10-13", task_status: "done" });
    expect(overdueTasks([kept, ticked], viewer).map((o) => o.date)).toEqual(["2026-10-20"]);
  });
});

describe("tasks view", () => {
  it("sorts tasks into sections", () => {
    const items = [
      item({ id: "undated-unassigned" }),
      item({ id: "dated-unassigned", all_day: true, start_date: "2026-11-02" }),
      item({ id: "mine-undated", assignees: [SIMONE] }),
      item({ id: "mine-dated", assignees: [SIMONE], starts_at: "2026-10-28T08:00:00Z" }),
      item({ id: "kats", assignees: [KAT] }),
      item({ id: "both", assignees: [KAT, SIMONE] }),
      item({ id: "to-me", assignees: [KAT] }),
      item({ id: "from-me", assignees: [SIMONE] }),
      item({ id: "finished", assignees: [SIMONE], task_status: "done", done_at: "2026-10-24T10:00:00Z" }),
      item({ id: "finished-later", task_status: "done", done_at: "2026-10-25T10:00:00Z" }),
      item({ id: "an-event", kind: "event", task_status: null, all_day: true, start_date: "2026-10-26" }),
    ];
    const proposals = [
      proposal({ item_id: "to-me", proposed_by: KAT, proposed_assignees: [SIMONE] }),
      proposal({ item_id: "from-me", proposed_assignees: [SIMONE, KAT] }),
    ];
    const s = taskSections({ items, proposals }, viewer);
    const ids = (list: { occ: { item: AgendaItem } }[]) => list.map((e) => e.occ.item.id);
    expect(ids(s.waiting)).toEqual(["to-me"]);
    expect(ids(s.undecided)).toEqual(["dated-unassigned", "undated-unassigned"]);
    expect(ids(s.mine)).toEqual(["mine-dated", "mine-undated", "from-me"]);
    expect(ids(s.theirs)).toEqual(["kats"]);
    expect(ids(s.both)).toEqual(["both"]);
    expect(s.mine[2].waitingFor?.proposed_assignees).toEqual([SIMONE, KAT]);
    expect(s.done.map((o) => o.item.id)).toEqual(["finished-later", "finished"]);
  });

  it("shows a series' next open occurrence, plus missed ones if kept", () => {
    const base = { all_day: true, start_date: "2026-10-06", recurrence: ["RRULE:FREQ=WEEKLY"], assignees: [SIMONE] };
    const tickedToday = item({ id: "t", recurring_item_id: "bins", original_start: "2026-10-27", all_day: true, start_date: "2026-10-27", task_status: "done" });
    const plain = taskSections({ items: [item({ id: "bins", ...base }), tickedToday], proposals: [] }, viewer);
    expect(plain.mine.map((e) => e.occ.date)).toEqual(["2026-11-03"]);
    expect(plain.done.map((o) => o.series?.id)).toEqual(["bins"]);

    const kept = taskSections({ items: [item({ id: "bins", ...base, keep_missed: true, created_at: "2026-10-01T00:00:00Z" })], proposals: [] }, viewer);
    expect(kept.mine.map((e) => [e.occ.date, e.overdue])).toEqual([
      ["2026-10-06", true],
      ["2026-10-13", true],
      ["2026-10-20", true],
      ["2026-10-27", false],
    ]);
  });

  it("flags a declined proposal until acknowledged", () => {
    const items = [item({ id: "x", assignees: [SIMONE] })];
    const declined = proposal({ item_id: "x", status: "declined", answered_by: KAT });
    expect(taskSections({ items, proposals: [declined] }, viewer).mine[0].declined?.id).toBe("p-x");
    const seen = { ...declined, acknowledged_at: "2026-10-03T00:00:00Z" };
    expect(taskSections({ items, proposals: [seen] }, viewer).mine[0].declined).toBeNull();
  });
});

describe("calendar filter", () => {
  it("shows only items assigned to me or both with Mine", () => {
    const event = (id: string, assignees: string[]) =>
      item({ id, kind: "event", task_status: null, all_day: true, start_date: "2026-10-25", assignees });
    const agenda = { items: [event("a", [SIMONE]), event("b", [KAT]), event("c", [KAT, SIMONE]), event("d", [])], proposals: [] };
    const [today] = calendarDays(agenda, viewer, "mine", "2026-10-25", 1);
    expect(today.occurrences.map((o) => o.item.id)).toEqual(["a", "c"]);
  });
});

describe("assigning", () => {
  it("needs an answer only when adding the other person", () => {
    expect(planAssignment([], [SIMONE], SIMONE)).toEqual({ kind: "direct", assignees: [SIMONE] });
    expect(planAssignment([], [KAT], SIMONE)).toEqual({ kind: "propose", assignees: [KAT] });
    expect(planAssignment([SIMONE], [SIMONE, KAT], SIMONE)).toEqual({ kind: "propose", assignees: [SIMONE, KAT] });
    expect(planAssignment([KAT], [], SIMONE)).toEqual({ kind: "direct", assignees: [] });
    expect(planAssignment([KAT], [SIMONE], SIMONE)).toEqual({ kind: "direct", assignees: [SIMONE] });
    expect(planAssignment([KAT], [KAT, SIMONE], SIMONE)).toEqual({ kind: "direct", assignees: [KAT, SIMONE] });
    expect(planAssignment([SIMONE], [SIMONE], SIMONE)).toEqual({ kind: "none" });
  });

  it("withdraws or keeps a pending proposal", () => {
    expect(planAssignment([SIMONE], [SIMONE], SIMONE, [KAT])).toEqual({ kind: "direct", assignees: [SIMONE] });
    expect(planAssignment([SIMONE], [KAT], SIMONE, [KAT])).toEqual({ kind: "none" });
  });

  it("maps form choices to ids", () => {
    expect(assigneeIds("both", SIMONE, KAT)).toEqual([SIMONE, KAT]);
    expect(assigneeChoice([KAT, SIMONE], SIMONE)).toBe("both");
    expect(assigneeChoice([KAT], SIMONE)).toBe("other");
  });
});

describe("nudge", () => {
  const sections = taskSections({ items: [item({ id: "a" })], proposals: [] }, viewer);
  const settings = { nudge_enabled: true, nudge_weekday: 0, nudge_dismissed_on: null };

  it("shows on the chosen day until dismissed", () => {
    expect(nudge(sections, settings, "2026-10-25")).toEqual({ undecided: 1, waiting: 0 });
    expect(nudge(sections, settings, "2026-10-26")).toBeNull();
    expect(nudge(sections, { ...settings, nudge_dismissed_on: "2026-10-25" }, "2026-10-25")).toBeNull();
    expect(nudge(sections, { ...settings, nudge_enabled: false }, "2026-10-25")).toBeNull();
  });
});
