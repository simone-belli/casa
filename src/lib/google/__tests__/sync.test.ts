import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleEvent } from "@/lib/agenda/google";

vi.mock("server-only", () => ({}));

// --- A small in-memory stand-in for the Supabase tables the sync uses ----------

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
let clock = Date.parse("2026-10-25T10:00:00Z");
const now = () => new Date((clock += 1000)).toISOString();

const UNIQUE: Record<string, string[][]> = {
  agenda_items: [["id"], ["recurring_item_id", "original_start"]],
  agenda_google_links: [["item_id"]],
  agenda_sync_state: [["id"]],
};

function prepare(table: string, row: Row): Row {
  if (table !== "agenda_items") return row;
  return {
    note: null,
    all_day: false,
    starts_at: null,
    ends_at: null,
    start_date: null,
    end_date: null,
    time_zone: "UTC",
    recurrence: null,
    keep_missed: false,
    recurring_item_id: null,
    original_start: null,
    cancelled: false,
    assignees: [],
    reminder_minutes: null,
    created_at: now(),
    ...row,
    id: row.id ?? crypto.randomUUID(),
    task_status: row.kind === "task" ? (row.task_status ?? "open") : null,
    updated_at: now(),
  };
}

function query(table: string) {
  const rows = (tables[table] ??= []);
  const filters: ((r: Row) => boolean)[] = [];
  let op: { kind: "select" } | { kind: "update"; values: Row } | { kind: "delete" } | { kind: "insert" | "upsert"; values: Row[]; onConflict?: string } = {
    kind: "select",
  };
  let single: "single" | "maybe" | null = null;

  const run = () => {
    let result: Row[] = [];
    if (op.kind === "select") result = rows.filter((r) => filters.every((f) => f(r)));
    if (op.kind === "update") {
      for (const r of rows.filter((r) => filters.every((f) => f(r)))) {
        Object.assign(r, op.values, table === "agenda_items" ? { updated_at: now() } : {});
        result.push(r);
      }
    }
    if (op.kind === "delete") {
      const keep = rows.filter((r) => !filters.every((f) => f(r)));
      result = rows.filter((r) => filters.every((f) => f(r)));
      rows.splice(0, rows.length, ...keep);
      // Deleting a series deletes its occurrences.
      if (table === "agenda_items") {
        const ids = new Set(result.map((r) => r.id));
        rows.splice(0, rows.length, ...rows.filter((r) => !ids.has(r.recurring_item_id)));
      }
    }
    if (op.kind === "insert" || op.kind === "upsert") {
      for (const values of op.values) {
        const keys = op.kind === "upsert" && op.onConflict ? [op.onConflict.split(",")] : (UNIQUE[table] ?? []);
        const existing = rows.find((r) =>
          keys.some((k) => k.every((c) => (values[c] ?? (c === "id" ? undefined : null)) !== undefined && r[c] === values[c] && r[c] !== null)),
        );
        if (existing && op.kind === "insert") return { data: null, error: { message: "duplicate", code: "23505" } };
        if (existing) {
          Object.assign(existing, values, table === "agenda_items" ? { updated_at: now() } : {});
          result.push(existing);
        } else {
          const row = prepare(table, values);
          rows.push(row);
          result.push(row);
        }
      }
    }
    const copy = result.map((r) => structuredClone(r));
    if (single === "single") return { data: copy[0] ?? null, error: copy[0] ? null : { message: "no rows" } };
    if (single === "maybe") return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null };
  };

  const builder = {
    select: () => builder,
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), builder),
    is: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
    update: (values: Row) => ((op = { kind: "update", values }), builder),
    delete: () => ((op = { kind: "delete" }), builder),
    insert: (values: Row | Row[]) => ((op = { kind: "insert", values: [values].flat() }), builder),
    upsert: (values: Row | Row[], options?: { onConflict?: string }) => ((op = { kind: "upsert", values: [values].flat(), onConflict: options?.onConflict }), builder),
    single: () => ((single = "single"), builder),
    maybeSingle: () => ((single = "maybe"), builder),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(run).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/service", () => ({
  supabaseService: () => ({
    from: query,
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              { id: "simone", email: "simone@example.com" },
              { id: "kat", email: "Kat@example.com" },
            ],
          },
          error: null,
        }),
      },
    },
  }),
}));

// --- A small stand-in for Google Calendar ----------------------------------------

const google = new Map<string, GoogleEvent & { changed: number }>();
let changes = 0;
let writes = 0;

function store(id: string, event: GoogleEvent) {
  const previous = google.get(id);
  const merged = { ...(previous ?? {}), ...event, id, etag: `"${++changes}"`, updated: new Date(clock).toISOString(), changed: changes };
  google.set(id, merged);
  return merged;
}

/** Someone changing the calendar in Google's own app. */
function editInGoogle(id: string, fields: Partial<GoogleEvent>) {
  clock += 60_000;
  return store(id, fields as GoogleEvent);
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const method = init?.method ?? "GET";
  const body = init?.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : null;
  const json = (status: number, data: unknown) => Promise.resolve(new Response(data === null ? null : JSON.stringify(data), { status }));

  if (url.hostname === "oauth2.googleapis.com") return json(200, { access_token: "token" });
  const path = decodeURIComponent(url.pathname.replace("/calendar/v3/calendars/casa", ""));
  if (path === "/events" && method === "GET") {
    const since = Number(url.searchParams.get("syncToken") ?? -1);
    const items = [...google.values()].filter((e) => (since < 0 ? e.status !== "cancelled" : e.changed > since));
    return json(200, { items, nextSyncToken: String(changes), timeZone: "Europe/Rome" });
  }
  if (path === "/events" && method === "POST") {
    writes++;
    if (google.has(body.id)) return json(409, { error: { message: "exists" } });
    return json(200, store(body.id, body));
  }
  const id = path.replace("/events/", "");
  if (method === "PATCH") {
    writes++;
    const series = google.get(id.split("_")[0]);
    if (!google.has(id) && !(id.includes("_") && series)) return json(404, { error: { message: "not found" } });
    const extra = id.includes("_") && !google.has(id) ? { recurringEventId: series!.id } : {};
    return json(200, store(id, { ...extra, ...body }));
  }
  if (method === "DELETE") {
    writes++;
    if (!google.has(id)) return json(410, { error: { message: "gone" } });
    store(id, { id, status: "cancelled" });
    return json(204, null);
  }
  return json(404, { error: { message: `unexpected ${method} ${url}` } });
}

// --- The tests ------------------------------------------------------------------

const { syncNow } = await import("../sync");
const { encrypt } = await import("../crypto");

const items = () => tables.agenda_items as Row[];
const item = (id: string) => items().find((i) => i.id === id)!;

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  google.clear();
  changes = 0;
  writes = 0;
  process.env.AGENDA_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  tables.allowed_emails = [
    { email: "simone@example.com", display_name: "Simone" },
    { email: "kat@example.com", display_name: "Kat" },
  ];
  tables.agenda_proposals = [];
  tables.agenda_sync_state = [{ id: 1, calendar_id: "casa", refresh_token_encrypted: encrypt("refresh"), sync_token: null, time_zone: "Europe/Rome" }];
  tables.agenda_items = [];
  tables.agenda_google_links = [];
});

const BINS = "11111111-1111-1111-1111-111111111111";
const BOILER = "22222222-2222-2222-2222-222222222222";
const binsEvent = BINS.replaceAll("-", "");

function addBins(fields: Row = {}) {
  items().push(
    prepare("agenda_items", {
      id: BINS,
      kind: "task",
      title: "Bins",
      all_day: true,
      start_date: "2026-10-27",
      recurrence: ["RRULE:FREQ=WEEKLY"],
      assignees: ["kat"],
      ...fields,
    }),
  );
}

describe("Google sync", () => {
  it("writes dated items, skips undated ones, and doesn't write again when nothing changed", async () => {
    addBins();
    items().push(prepare("agenda_items", { id: BOILER, kind: "task", title: "Book boiler" }));
    expect(await syncNow()).toEqual({ connected: true });

    expect([...google.keys()]).toEqual([binsEvent]);
    expect(google.get(binsEvent)).toMatchObject({ summary: "☐ Bins", description: "Assigned: Kat", recurrence: ["RRULE:FREQ=WEEKLY"] });

    writes = 0;
    await syncNow();
    expect(writes).toBe(0);
  });

  it("brings changes made in Google back, without the prefix piling up", async () => {
    addBins();
    await syncNow();
    editInGoogle(binsEvent, { summary: "☐ Bins and recycling", description: "Green bin\n\nAssigned: Kat" });
    await syncNow();
    expect(item(BINS)).toMatchObject({ title: "Bins and recycling", note: "Green bin" });
    expect(google.get(binsEvent)).toMatchObject({ summary: "☐ Bins and recycling", description: "Green bin\n\nAssigned: Kat" });

    writes = 0;
    await syncNow();
    expect(writes).toBe(0);
  });

  it("ticks off one occurrence of a series in Google", async () => {
    addBins();
    await syncNow();
    items().push(prepare("agenda_items", { kind: "task", title: "Bins", recurring_item_id: BINS, original_start: "2026-11-03", all_day: true, start_date: "2026-11-03", task_status: "done", assignees: ["kat"] }));
    await syncNow();
    expect(google.get(`${binsEvent}_20261103`)).toMatchObject({ summary: "☑ Bins", recurringEventId: binsEvent });
    expect(items().filter((i) => i.recurring_item_id === BINS)).toHaveLength(1);
  });

  it("shows a pending proposal in the description", async () => {
    addBins({ assignees: [] });
    tables.agenda_proposals.push({ id: "p", item_id: BINS, proposed_by: "simone", proposed_assignees: ["kat"], status: "pending" });
    await syncNow();
    expect(google.get(binsEvent)?.description).toBe("Proposed to Kat");
    tables.agenda_proposals = [];
    await syncNow();
    expect(google.get(binsEvent)?.description).toBe("Assigned: Unassigned");
  });

  it("removes an item from Google when it's deleted or loses its date", async () => {
    addBins();
    items().push(prepare("agenda_items", { id: BOILER, kind: "task", title: "Book boiler", all_day: true, start_date: "2026-10-30" }));
    await syncNow();
    tables.agenda_items = items().filter((i) => i.id !== BINS);
    Object.assign(item(BOILER), { all_day: false, start_date: null, updated_at: now() });
    await syncNow();
    expect([...google.values()].filter((e) => e.status !== "cancelled")).toEqual([]);
    expect(tables.agenda_google_links).toEqual([]);
  });

  it("brings in events made in Google for both of us, and deletions", async () => {
    store("fromgoogle", { id: "fromgoogle", status: "confirmed", summary: "Dinner at Marco's", start: { dateTime: "2026-10-31T19:00:00+01:00" }, end: { dateTime: "2026-10-31T22:00:00+01:00" } });
    await syncNow();
    const dinner = items().find((i) => i.title === "Dinner at Marco's")!;
    expect(dinner).toMatchObject({ kind: "event", starts_at: "2026-10-31T18:00:00Z", ends_at: "2026-10-31T21:00:00Z", time_zone: "Europe/Rome" });
    expect([...(dinner.assignees as string[])].sort()).toEqual(["kat", "simone"]);
    // Agenda adds its assignment line once.
    expect(google.get("fromgoogle")?.description).toBe("Assigned: Both");

    editInGoogle("fromgoogle", { status: "cancelled" });
    await syncNow();
    expect(items().find((i) => i.id === dinner.id)).toBeUndefined();
  });

  it("keeps the newer side when both changed at once", async () => {
    addBins();
    await syncNow();
    editInGoogle(binsEvent, { summary: "☐ Bins (Google)" });
    clock += 60_000;
    Object.assign(item(BINS), { title: "Bins (Agenda)", updated_at: now() });
    await syncNow();
    expect(item(BINS).title).toBe("Bins (Agenda)");
    expect(google.get(binsEvent)?.summary).toBe("☐ Bins (Agenda)");
  });
});
