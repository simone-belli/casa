import "server-only";

import {
  assignedLine,
  eventBody,
  eventIdFor,
  fieldsFromEvent,
  instanceId,
  isInstanceId,
  occurrenceFromGoogle,
  type EventBody,
  type FieldsFromGoogle,
  type GoogleEvent,
} from "@/lib/agenda/google";
import { isDated } from "@/lib/agenda/occurrences";
import type { AgendaItem, Proposal } from "@/lib/agenda/types";
import { selectAll } from "@/lib/supabase/select-all";
import { supabaseService } from "@/lib/supabase/service";
import {
  accessToken,
  deleteEvent,
  GoogleAuthError,
  GoogleError,
  insertEvent,
  listCalendars,
  listEvents,
  patchEvent,
  stopChannel,
  watchEvents,
} from "./calendar";
import { decrypt, encrypt, randomToken, sha256 } from "./crypto";

type SyncState = {
  google_account: string | null;
  calendar_id: string | null;
  calendar_name: string | null;
  time_zone: string | null;
  refresh_token_encrypted: string | null;
  sync_token: string | null;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_token: string | null;
  channel_expires_at: string | null;
  channel_address: string | null;
};

type Link = { item_id: string; google_event_id: string; google_etag: string | null; pushed_hash: string | null };

const db = () => supabaseService();

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function loadState(): Promise<SyncState | null> {
  const { data, error } = await db().from("agenda_sync_state").select("*").eq("id", 1).maybeSingle();
  check(error);
  return data as SyncState | null;
}

async function saveState(fields: Partial<SyncState> & { last_error?: string | null; last_sync_at?: string }): Promise<void> {
  check((await db().from("agenda_sync_state").upsert({ id: 1, ...fields, updated_at: new Date().toISOString() })).error);
}

async function tokenFor(state: SyncState): Promise<string> {
  if (!state.refresh_token_encrypted) throw new GoogleAuthError("Google Calendar isn't connected.");
  return accessToken(decrypt(state.refresh_token_encrypted));
}

/** Household members: names by user id. */
async function members(): Promise<Map<string, string>> {
  const service = db();
  const [{ data: allowed, error }, { data: users, error: usersError }] = await Promise.all([
    service.from("allowed_emails").select("email, display_name"),
    service.auth.admin.listUsers({ perPage: 100 }),
  ]);
  check(error);
  check(usersError);
  const names = new Map((allowed as { email: string; display_name: string }[]).map((a) => [a.email, a.display_name]));
  const result = new Map<string, string>();
  for (const user of users.users) {
    const name = user.email ? names.get(user.email.toLowerCase()) : undefined;
    if (name) result.set(user.id, name);
  }
  return result;
}

type Snapshot = {
  items: Map<string, AgendaItem>;
  proposals: Proposal[];
  links: Link[];
  names: Map<string, string>;
};

async function snapshot(): Promise<Snapshot> {
  const service = db();
  const [items, proposals, links, names] = await Promise.all([
    selectAll<AgendaItem>((from, to) => service.from("agenda_items").select("*").order("id").range(from, to)),
    selectAll<Proposal>((from, to) => service.from("agenda_proposals").select("*").eq("status", "pending").order("id").range(from, to)),
    selectAll<Link>((from, to) =>
      service.from("agenda_google_links").select("item_id, google_event_id, google_etag, pushed_hash").order("item_id").range(from, to),
    ),
    members(),
  ]);
  return { items: new Map(items.map((i) => [i.id, i])), proposals, links, names };
}

/** What Agenda would write to Google for an item now, and its hash. */
function desired(item: AgendaItem, snap: Snapshot): { body: EventBody; hash: string } {
  const owner = item.recurring_item_id ? (snap.items.get(item.recurring_item_id) ?? item) : item;
  const pending = snap.proposals.find((p) => p.item_id === owner.id) ?? null;
  const body = eventBody(item, assignedLine(owner, pending, (id) => snap.names.get(id) ?? null));
  return { body, hash: sha256(JSON.stringify(body)) };
}

async function saveLink(link: Link): Promise<void> {
  check(
    (
      await db()
        .from("agenda_google_links")
        .upsert({ ...link, last_synced_at: new Date().toISOString() }, { onConflict: "item_id" })
    ).error,
  );
}

async function dropLink(itemId: string): Promise<void> {
  check((await db().from("agenda_google_links").delete().eq("item_id", itemId)).error);
}

const gone = (error: unknown) => error instanceof GoogleError && (error.status === 404 || error.status === 410);

// --- Google → Agenda --------------------------------------------------------------

/** The item fields to write for an event, for an item of `kind`. */
function itemFields(fields: FieldsFromGoogle, kind: AgendaItem["kind"], isOccurrence: boolean): Partial<AgendaItem> {
  const { done, ...rest } = fields;
  const result: Partial<AgendaItem> = { ...rest };
  if (isOccurrence) delete result.recurrence;
  // A task without an end time is written to Google with end = start.
  if (kind === "task" && rest.ends_at === rest.starts_at) result.ends_at = null;
  if (kind === "task" && done !== null) result.task_status = done ? "done" : "open";
  return result;
}

async function pullEvent(event: GoogleEvent, snap: Snapshot, calendarZone: string): Promise<void> {
  const service = db();
  const byEvent = new Map(snap.links.map((l) => [l.google_event_id, l]));
  const link = byEvent.get(event.id);
  // Our own write coming back.
  if (link && link.google_etag && link.google_etag === event.etag) return;
  const linked = link ? snap.items.get(link.item_id) : undefined;
  const series = event.recurringEventId ? snap.items.get(byEvent.get(event.recurringEventId)?.item_id ?? "") : undefined;
  const occurrence = occurrenceFromGoogle(event.originalStartTime);

  if (event.status === "cancelled") {
    if (linked?.recurring_item_id) {
      check((await service.from("agenda_items").update({ cancelled: true }).eq("id", linked.id)).error);
      await saveLink({ ...link!, google_etag: event.etag ?? null, pushed_hash: null });
    } else if (linked) {
      check((await service.from("agenda_items").delete().eq("id", linked.id)).error);
      await dropLink(linked.id);
    } else if (link) {
      await dropLink(link.item_id);
    } else if (series && occurrence) {
      // No id: on a conflict the existing row keeps its own.
      const { error } = await service.from("agenda_items").upsert(
        { ...copyOfSeries(series), recurring_item_id: series.id, original_start: occurrence, ...seriesDates(series, event), cancelled: true },
        { onConflict: "recurring_item_id,original_start" },
      );
      check(error);
    }
    return;
  }

  const fields = fieldsFromEvent(event, calendarZone);
  if (!fields) return;

  if (link && linked) {
    // Changed on both sides at almost the same moment: the most recent change wins.
    const local = desired(linked, snap);
    const unpushed = link.pushed_hash !== null && local.hash !== link.pushed_hash;
    if (unpushed && event.updated && linked.updated_at > event.updated) return;
    check((await service.from("agenda_items").update(itemFields(fields, linked.kind, Boolean(linked.recurring_item_id))).eq("id", linked.id)).error);
    await saveLink({ ...link, google_etag: event.etag ?? null, pushed_hash: null });
    return;
  }
  if (link) return; // Deleted in Agenda; the push removes it from Google.

  // Not linked yet: one of ours whose link was lost, a changed occurrence, or a new event.
  const ownId = event.extendedProperties?.private?.agendaItemId;
  const own = ownId ? snap.items.get(ownId) : undefined;
  if (own) {
    check((await service.from("agenda_items").update(itemFields(fields, own.kind, Boolean(own.recurring_item_id))).eq("id", own.id)).error);
    await saveLink({ item_id: own.id, google_event_id: event.id, google_etag: event.etag ?? null, pushed_hash: null });
    return;
  }

  if (event.recurringEventId) {
    if (!series || !occurrence) return;
    const { data, error } = await service
      .from("agenda_items")
      .upsert(
        { ...copyOfSeries(series), ...itemFields(fields, series.kind, true), recurring_item_id: series.id, original_start: occurrence, cancelled: false },
        { onConflict: "recurring_item_id,original_start" },
      )
      .select("id")
      .single();
    check(error);
    await saveLink({ item_id: (data as { id: string }).id, google_event_id: event.id, google_etag: event.etag ?? null, pushed_hash: null });
    return;
  }

  // Created in Google: an event for both of us.
  const id = crypto.randomUUID();
  check(
    (
      await service.from("agenda_items").insert({
        id,
        kind: "event",
        ...itemFields(fields, "event", false),
        assignees: [...snap.names.keys()].slice(0, 2),
      })
    ).error,
  );
  await saveLink({ item_id: id, google_event_id: event.id, google_etag: event.etag ?? null, pushed_hash: null });
}

const COPIED = ["kind", "title", "note", "time_zone", "reminder_minutes", "assignees", "all_day"] as const;

function copyOfSeries(series: AgendaItem): Partial<AgendaItem> {
  return Object.fromEntries(COPIED.map((k) => [k, series[k]]));
}

/** Dates for a cancelled occurrence row (it needs valid ones, though they aren't shown). */
function seriesDates(series: AgendaItem, event: GoogleEvent): Partial<AgendaItem> {
  const start = event.originalStartTime;
  if (series.all_day) return { all_day: true, start_date: start?.date ?? series.start_date, starts_at: null, ends_at: null };
  return { all_day: false, start_date: null, end_date: null, starts_at: start?.dateTime ?? series.starts_at, ends_at: null };
}

/**
 * Runs one step; a failure is logged and counted instead of stopping the
 * whole sync (except a refused Google sign-in, which stops everything).
 */
async function attempt(what: string, step: () => Promise<unknown>): Promise<number> {
  try {
    await step();
    return 0;
  } catch (error) {
    if (error instanceof GoogleAuthError) throw error;
    console.error(`Agenda sync: failed ${what}`, error);
    return 1;
  }
}

/** Reads what changed in Google; returns how many events couldn't be read. */
async function pull(state: SyncState, token: string): Promise<number> {
  let syncToken = state.sync_token;
  for (let round = 0; round < 2; round++) {
    try {
      const events: GoogleEvent[] = [];
      let pageToken: string | undefined;
      let next: string | undefined;
      let zone = state.time_zone ?? "UTC";
      do {
        const page = await listEvents(token, state.calendar_id!, syncToken, pageToken);
        events.push(...(page.items ?? []));
        if (page.timeZone) zone = page.timeZone;
        pageToken = page.nextPageToken;
        next = page.nextSyncToken;
      } while (pageToken);

      // Series first, then their changed occurrences, which need the series' links.
      let problems = 0;
      for (const phase of [events.filter((e) => !e.recurringEventId), events.filter((e) => e.recurringEventId)]) {
        if (phase.length === 0) continue;
        const snap = await snapshot();
        for (const event of phase) problems += await attempt(`reading Google event ${event.id}`, () => pullEvent(event, snap, zone));
      }
      await saveState({ sync_token: next ?? syncToken, time_zone: zone });
      return problems;
    } catch (error) {
      // The sync token expired: start again from everything.
      if (error instanceof GoogleError && error.status === 410 && syncToken) {
        syncToken = null;
        continue;
      }
      throw error;
    }
  }
  return 0;
}

// --- Agenda → Google ---------------------------------------------------------------

/** Writes what changed in Agenda; returns how many items couldn't be written. */
async function push(state: SyncState, token: string): Promise<number> {
  const calendarId = state.calendar_id!;
  const snap = await snapshot();
  const byItem = new Map(snap.links.map((l) => [l.item_id, l]));

  const write = async (item: AgendaItem, eventId: string, existing: Link | undefined) => {
    const { body, hash } = desired(item, snap);
    if (existing && existing.pushed_hash === hash) return existing;
    let saved: GoogleEvent;
    if (existing || item.recurring_item_id) {
      try {
        saved = await patchEvent(token, calendarId, eventId, body);
      } catch (error) {
        if (!gone(error) || item.recurring_item_id) throw error;
        saved = await insertEvent(token, calendarId, eventId, body);
      }
    } else {
      try {
        saved = await insertEvent(token, calendarId, eventId, body);
      } catch (error) {
        // Already there (e.g. written before, or deleted and now back): update it.
        if (!(error instanceof GoogleError && error.status === 409)) throw error;
        saved = await patchEvent(token, calendarId, eventId, body);
      }
    }
    const link = { item_id: item.id, google_event_id: saved.id ?? eventId, google_etag: saved.etag ?? null, pushed_hash: hash };
    await saveLink(link);
    return link;
  };

  const remove = async (eventId: string) => {
    await deleteEvent(token, calendarId, eventId).catch((e) => {
      if (!gone(e)) throw e;
    });
  };

  // Items and series first, then their changed occurrences.
  let problems = 0;
  const links = new Map<string, Link>();
  for (const item of snap.items.values()) {
    if (item.recurring_item_id) continue;
    const existing = byItem.get(item.id);
    problems += await attempt(`writing item ${item.id}`, async () => {
      if (isDated(item)) {
        links.set(item.id, await write(item, existing?.google_event_id ?? eventIdFor(item.id), existing));
      } else if (existing) {
        // Undated tasks aren't in Google.
        await remove(existing.google_event_id);
        await dropLink(item.id);
      }
    });
  }
  for (const item of snap.items.values()) {
    if (!item.recurring_item_id || !item.original_start) continue;
    const seriesLink = links.get(item.recurring_item_id);
    if (!seriesLink) continue;
    const existing = byItem.get(item.id);
    const eventId = existing?.google_event_id ?? instanceId(seriesLink.google_event_id, item.original_start);
    problems += await attempt(`writing occurrence ${item.id}`, async () => {
      try {
        await write(item, eventId, existing);
      } catch (error) {
        // The occurrence isn't in the series in Google any more: nothing to change.
        if (!gone(error)) throw error;
        await saveLink({ item_id: item.id, google_event_id: eventId, google_etag: null, pushed_hash: desired(item, snap).hash });
      }
    });
  }

  // Deleted in Agenda.
  for (const link of snap.links) {
    if (snap.items.has(link.item_id)) continue;
    problems += await attempt(`deleting event ${link.google_event_id}`, async () => {
      // Deleting from Google can't be undone from here: make sure the item
      // really is gone, not just missing from what was read.
      const { data, error } = await db().from("agenda_items").select("id").eq("id", link.item_id).maybeSingle();
      check(error);
      if (data) return;
      // A dropped occurrence row goes back to the series' default; deleting it
      // in Google would cancel the occurrence instead.
      if (!isInstanceId(link.google_event_id)) await remove(link.google_event_id);
      await dropLink(link.item_id);
    });
  }
  return problems;
}

// --- What the routes call -------------------------------------------------------------

let running: Promise<SyncResult> | null = null;
let again = false;

export type SyncResult = { connected: boolean; error?: string };

/**
 * Brings Agenda and the Casa calendar up to date in both directions: first
 * what changed in Google, then what changed in Agenda. Calls that arrive
 * while one is running are folded into one more run.
 */
export function syncNow(): Promise<SyncResult> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let result: SyncResult = { connected: false };
    do {
      again = false;
      result = await syncOnce();
    } while (again);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(): Promise<SyncResult> {
  const state = await loadState();
  if (!state?.calendar_id) return { connected: false };
  try {
    const token = await tokenFor(state);
    const problems = (await pull(state, token)) + (await push(state, token));
    const error = problems > 0 ? `${problems} change${problems === 1 ? "" : "s"} couldn't be synced. They'll be tried again.` : null;
    await saveState({ last_sync_at: new Date().toISOString(), last_error: error });
    return error ? { connected: true, error } : { connected: true };
  } catch (error) {
    console.error("Agenda sync failed", error);
    const message = error instanceof Error ? error.message : String(error);
    await saveState({ last_error: message }).catch(() => {});
    return { connected: true, error: message };
  }
}

/** Saves a newly connected Google account; a calendar is picked next. */
export async function connectAccount(email: string | null, refreshToken: string): Promise<void> {
  await stopWatching().catch(() => {});
  check((await db().from("agenda_google_links").delete().neq("item_id", "00000000-0000-0000-0000-000000000000")).error);
  await saveState({
    google_account: email,
    refresh_token_encrypted: encrypt(refreshToken),
    calendar_id: null,
    calendar_name: null,
    sync_token: null,
    time_zone: null,
    last_error: null,
    ...NO_CHANNEL,
  });
}

export async function calendars() {
  const state = await loadState();
  if (!state) throw new GoogleAuthError("Google Calendar isn't connected.");
  return listCalendars(await tokenFor(state));
}

const NO_CHANNEL = { channel_id: null, channel_resource_id: null, channel_token: null, channel_expires_at: null };

/**
 * Starts syncing with a calendar: links are reset, change notifications go
 * to `notifyAddress` (https only), and everything is synced once.
 */
export async function pickCalendar(calendarId: string, notifyAddress: string | null): Promise<SyncResult> {
  const list = await calendars();
  const picked = list.find((c) => c.id === calendarId);
  if (!picked) throw new GoogleError("That calendar isn't in the account, or Casa can't change it.", 400);
  await stopWatching().catch(() => {});
  check((await db().from("agenda_google_links").delete().neq("item_id", "00000000-0000-0000-0000-000000000000")).error);
  await saveState({
    calendar_id: picked.id,
    calendar_name: picked.summary,
    time_zone: picked.timeZone ?? null,
    sync_token: null,
    channel_address: notifyAddress,
    ...NO_CHANNEL,
  });
  await renewWatch(true);
  return syncNow();
}

export async function disconnect(): Promise<void> {
  await stopWatching().catch(() => {});
  check((await db().from("agenda_google_links").delete().neq("item_id", "00000000-0000-0000-0000-000000000000")).error);
  check((await db().from("agenda_sync_state").delete().eq("id", 1)).error);
}

async function stopWatching(): Promise<void> {
  const state = await loadState();
  if (!state?.channel_id || !state.channel_resource_id) return;
  await stopChannel(await tokenFor(state), state.channel_id, state.channel_resource_id).catch((e) => {
    if (!gone(e)) throw e;
  });
  await saveState(NO_CHANNEL);
}

/** How long before a subscription expires it is renewed. */
const RENEW_BEFORE_MS = 2 * 24 * 3_600_000;

/** Subscribes to change notifications, or renews the subscription if it expires soon. */
export async function renewWatch(force = false): Promise<void> {
  const state = await loadState();
  if (!state?.calendar_id || !state.channel_address?.startsWith("https://")) return;
  const expires = state.channel_expires_at ? new Date(state.channel_expires_at).getTime() : 0;
  if (!force && state.channel_id && expires - Date.now() > RENEW_BEFORE_MS) return;
  await stopWatching().catch(() => {});
  const channel = { id: crypto.randomUUID(), token: randomToken(), address: state.channel_address };
  const { resourceId, expiresAt } = await watchEvents(await tokenFor(state), state.calendar_id, channel);
  await saveState({ channel_id: channel.id, channel_token: channel.token, channel_resource_id: resourceId, channel_expires_at: expiresAt });
}

/** Whether a change notification really comes from our subscription. */
export async function isOurChannel(channelId: string | null, channelToken: string | null): Promise<boolean> {
  const state = await loadState();
  return Boolean(state?.channel_id && channelId === state.channel_id && channelToken === state.channel_token);
}
