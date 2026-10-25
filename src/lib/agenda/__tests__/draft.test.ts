import { describe, expect, it } from "vitest";
import { draftFromOccurrence, draftProblem, fieldsFromDraft, newDraft, seriesFieldsFromOccurrenceDraft, withKind } from "../draft";
import { seriesOccurrences, singleOccurrence } from "../occurrences";
import { NO_REPEAT } from "../recurrence";
import type { AgendaItem } from "../types";

const ROME = "Europe/Rome";
const ME = "simone";

const row = (fields: Partial<AgendaItem>): AgendaItem => ({
  id: "x",
  kind: "event",
  title: "Party",
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
  task_status: null,
  done_at: null,
  done_by: null,
  reminder_minutes: null,
  created_by: ME,
  updated_by: ME,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...fields,
});

describe("drafts", () => {
  it("starts a new event at the next hour and a task undated", () => {
    const now = new Date("2026-10-25T16:20:00Z"); // 17:20 in Rome
    expect(newDraft("event", ROME, "2026-10-31", now)).toMatchObject({ dated: true, date: "2026-10-31", startTime: "18:00", endTime: "19:00" });
    expect(newDraft("task", ROME, undefined, now)).toMatchObject({ dated: false, endTime: "" });
  });

  it("turns a timed draft into UTC fields in its time zone", () => {
    const draft = { ...newDraft("event", ROME, "2026-10-31"), title: " Party ", startTime: "19:00", endTime: "23:30" };
    expect(fieldsFromDraft(draft, ROME)).toMatchObject({
      title: "Party",
      all_day: false,
      starts_at: "2026-10-31T18:00:00Z",
      ends_at: "2026-10-31T22:30:00Z",
      start_date: null,
      recurrence: null,
    });
  });

  it("round-trips an all-day multi-day event", () => {
    const item = row({ all_day: true, start_date: "2026-10-30", end_date: "2026-11-01", reminder_minutes: 1440 });
    const draft = draftFromOccurrence(singleOccurrence(item, ROME), ROME, ME);
    expect(draft).toMatchObject({ allDay: true, date: "2026-10-30", endDate: "2026-11-01", reminder: 1440 });
    expect(fieldsFromDraft(draft, ROME)).toMatchObject({ all_day: true, start_date: "2026-10-30", end_date: "2026-11-01", starts_at: null });
  });

  it("drops what an undated task can't have", () => {
    const draft = { ...newDraft("task", ROME), title: "Boiler", reminder: 30, repeat: { ...NO_REPEAT, freq: "weekly" as const } };
    expect(fieldsFromDraft(draft, ROME)).toMatchObject({ starts_at: null, start_date: null, recurrence: null, reminder_minutes: null });
  });

  it("keeps missed occurrences only for recurring tasks", () => {
    const draft = { ...newDraft("task", ROME, "2026-10-27"), title: "Bins", allDay: true, keepMissed: true };
    expect(fieldsFromDraft(draft, ROME).keep_missed).toBe(false);
    expect(fieldsFromDraft({ ...draft, repeat: { ...NO_REPEAT, freq: "weekly" } }, ROME)).toMatchObject({
      keep_missed: true,
      recurrence: ["RRULE:FREQ=WEEKLY"],
    });
  });

  it("checks for problems", () => {
    const event = { ...newDraft("event", ROME, "2026-10-31"), title: "Party" };
    expect(draftProblem({ ...event, title: " " })).toBe("Give it a title.");
    expect(draftProblem({ ...event, endTime: "" })).toBe("Give the event an end time.");
    expect(draftProblem({ ...event, startTime: "20:00", endTime: "19:00" })).toBe("It can't end before it starts.");
    expect(draftProblem({ ...event, startTime: "23:00", endTime: "01:00", endDate: "2026-11-01" })).toBeNull();
    expect(draftProblem(withKind({ ...newDraft("task", ROME), title: "x" }, "event"))).toBeNull();
  });

  it("moves a whole series by as many days as one occurrence was moved", () => {
    const series = row({ starts_at: "2026-10-06T17:00:00Z", ends_at: "2026-10-06T18:00:00Z", recurrence: ["RRULE:FREQ=WEEKLY"] });
    const occ = seriesOccurrences(series, undefined, "2026-10-31", ROME)[3]; // Tue 27 Oct, 19:00 local (winter time)
    const draft = { ...draftFromOccurrence(occ, ROME, ME), date: "2026-10-28", endDate: "2026-10-28", startTime: "20:00", endTime: "21:00" };
    expect(seriesFieldsFromOccurrenceDraft(draft, occ, series, ROME)).toMatchObject({
      starts_at: "2026-10-07T18:00:00Z",
      ends_at: "2026-10-07T19:00:00Z",
      recurrence: ["RRULE:FREQ=WEEKLY"],
    });
  });
});
