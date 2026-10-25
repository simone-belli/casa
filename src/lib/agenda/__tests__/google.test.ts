import { describe, expect, it } from "vitest";
import {
  assignedLine,
  eventBody,
  eventIdFor,
  fieldsFromEvent,
  instanceId,
  isInstanceId,
  occurrenceFromGoogle,
  readDescription,
  readSummary,
  type GoogleEvent,
} from "../google";
import type { AgendaItem, Proposal } from "../types";

const names: Record<string, string> = { simone: "Simone", kat: "Kat" };
const nameOf = (id: string) => names[id] ?? null;

const item = (fields: Partial<AgendaItem>): AgendaItem => ({
  id: "0b8e4a52-6c1d-4e0f-9a3b-2d5c7e8f9a10",
  kind: "task",
  title: "Bins",
  note: null,
  all_day: false,
  starts_at: null,
  ends_at: null,
  start_date: null,
  end_date: null,
  time_zone: "Europe/Rome",
  recurrence: null,
  keep_missed: false,
  recurring_item_id: null,
  original_start: null,
  cancelled: false,
  assignees: [],
  task_status: "open",
  done_at: null,
  done_by: null,
  reminder_minutes: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...fields,
});

/** What Google would hand back for a body Agenda wrote. */
const asEvent = (id: string, body: ReturnType<typeof eventBody>): GoogleEvent => ({
  id,
  etag: '"1"',
  ...body,
  start: { date: body.start?.date ?? undefined, dateTime: body.start?.dateTime ? body.start.dateTime.replace("Z", "+00:00") : undefined, timeZone: body.start?.timeZone ?? undefined },
  end: { date: body.end?.date ?? undefined, dateTime: body.end?.dateTime ?? undefined, timeZone: body.end?.timeZone ?? undefined },
});

describe("Agenda → Google", () => {
  it("writes a task with its tick box, note, assignment and reminder", () => {
    const task = item({ all_day: true, start_date: "2026-10-27", note: "Green bin", assignees: ["kat"], reminder_minutes: 60, recurrence: ["RRULE:FREQ=WEEKLY"] });
    expect(eventBody(task, assignedLine(task, null, nameOf))).toEqual({
      status: "confirmed",
      summary: "☐ Bins",
      description: "Green bin\n\nAssigned: Kat",
      start: { date: "2026-10-27", dateTime: null, timeZone: null },
      end: { date: "2026-10-28", dateTime: null, timeZone: null },
      recurrence: ["RRULE:FREQ=WEEKLY"],
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 60 }] },
      extendedProperties: { private: { agendaItemId: task.id } },
    });
    expect(eventBody({ ...task, task_status: "done" }, "x").summary).toBe("☑ Bins");
  });

  it("writes events without a prefix, and a task with no end time as zero length", () => {
    const party = item({ kind: "event", task_status: null, title: "Party", starts_at: "2026-10-31T18:00:00Z", ends_at: "2026-10-31T22:00:00Z" });
    expect(eventBody(party, "Assigned: Both")).toMatchObject({ summary: "Party", end: { dateTime: "2026-10-31T22:00:00Z", timeZone: "Europe/Rome" } });
    const call = item({ starts_at: "2026-10-28T08:00:00Z" });
    expect(eventBody(call, "x").end).toEqual({ date: null, dateTime: "2026-10-28T08:00:00Z", timeZone: "Europe/Rome" });
  });

  it("names the assignment, or the pending proposal", () => {
    const task = item({ assignees: ["simone", "kat"] });
    expect(assignedLine(task, null, nameOf)).toBe("Assigned: Both");
    expect(assignedLine(item({}), null, nameOf)).toBe("Assigned: Unassigned");
    const pending = { proposed_assignees: ["kat"] } as Proposal;
    expect(assignedLine(task, pending, nameOf)).toBe("Proposed to Kat");
    expect(assignedLine(task, { proposed_assignees: ["kat", "simone"] } as Proposal, nameOf)).toBe("Proposed to both");
  });

  it("sends occurrences without a recurrence, and cancelled ones as just that", () => {
    const occ = item({ recurring_item_id: "series", original_start: "2026-10-27", all_day: true, start_date: "2026-10-27" });
    expect("recurrence" in eventBody(occ, "x")).toBe(false);
    expect(eventBody({ ...occ, cancelled: true }, "x")).toEqual({ status: "cancelled" });
  });

  it("makes Google ids", () => {
    expect(eventIdFor("0B8E4A52-6c1d-4e0f-9a3b-2d5c7e8f9a10")).toBe("0b8e4a526c1d4e0f9a3b2d5c7e8f9a10");
    expect(instanceId("abc", "2026-10-27T18:00:00Z")).toBe("abc_20261027T180000Z");
    expect(instanceId("abc", "2026-10-27")).toBe("abc_20261027");
    expect(isInstanceId("abc_20261027T180000Z")).toBe(true);
    expect(isInstanceId("abc_20261027")).toBe(true);
    expect(isInstanceId("0b8e4a526c1d4e0f9a3b2d5c7e8f9a10")).toBe(false);
  });
});

describe("Google → Agenda", () => {
  it("strips Agenda's own prefix and assignment line", () => {
    expect(readSummary("☑ Bins")).toEqual({ title: "Bins", done: true });
    expect(readSummary("☐Bins")).toEqual({ title: "Bins", done: false });
    expect(readSummary("Dinner")).toEqual({ title: "Dinner", done: null });
    expect(readDescription("Green bin\n\nAssigned: Kat")).toBe("Green bin");
    expect(readDescription("Proposed to Kat")).toBeNull();
    expect(readDescription("Bring wine<br><br>Assigned: Both")).toBe("Bring wine");
  });

  it("reads all-day and timed events", () => {
    expect(fieldsFromEvent({ id: "a", summary: "Trip", start: { date: "2026-10-30" }, end: { date: "2026-11-02" } }, "Europe/Rome")).toMatchObject({
      all_day: true,
      start_date: "2026-10-30",
      end_date: "2026-11-01",
      time_zone: "Europe/Rome",
      reminder_minutes: null,
    });
    expect(
      fieldsFromEvent(
        {
          id: "b",
          summary: "Dentist",
          start: { dateTime: "2026-10-28T10:00:00+01:00", timeZone: "Europe/London" },
          end: { dateTime: "2026-10-28T11:00:00+01:00" },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
          recurrence: ["RRULE:FREQ=MONTHLY"],
        },
        "Europe/Rome",
      ),
    ).toMatchObject({
      all_day: false,
      starts_at: "2026-10-28T09:00:00Z",
      ends_at: "2026-10-28T10:00:00Z",
      time_zone: "Europe/London",
      reminder_minutes: 30,
      recurrence: ["RRULE:FREQ=MONTHLY"],
    });
    expect(fieldsFromEvent({ id: "c", summary: "?" }, "UTC")).toBeNull();
  });

  it("reads occurrence keys", () => {
    expect(occurrenceFromGoogle({ date: "2026-10-27" })).toBe("2026-10-27");
    expect(occurrenceFromGoogle({ dateTime: "2026-10-27T19:00:00+01:00" })).toBe("2026-10-27T18:00:00Z");
  });

  it("gets back what it wrote", () => {
    const task = item({ starts_at: "2026-10-28T08:00:00Z", ends_at: "2026-10-28T08:30:00Z", note: "Call first", reminder_minutes: 10, task_status: "done" });
    const back = fieldsFromEvent(asEvent("x", eventBody(task, assignedLine(task, null, nameOf))), "UTC")!;
    expect(back).toMatchObject({
      title: task.title,
      done: true,
      note: task.note,
      starts_at: task.starts_at,
      ends_at: task.ends_at,
      time_zone: task.time_zone,
      reminder_minutes: 10,
      recurrence: null,
    });
  });
});
