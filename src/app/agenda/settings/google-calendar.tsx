"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarsResponse } from "@/app/api/agenda/google/calendars/route";
import { ui } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

type Status = { google_account: string | null; calendar_name: string | null; last_sync_at: string | null; last_error: string | null; live: boolean };
type Calendar = { id: string; name: string; primary: boolean };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Settings → Agenda → Google Calendar: connect, pick the Casa calendar, see how syncing is going. */
export function GoogleCalendar() {
  const [status, setStatus] = useState<Status | null | undefined>(undefined);
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabaseBrowser().rpc("agenda_sync_status");
    if (loadError) {
      setError(
        loadError.message.includes("agenda_sync_status")
          ? "Google sync isn't set up in the database yet: run migration 0007_agenda_sync.sql in Supabase."
          : "Couldn't load the Google Calendar status.",
      );
      setStatus(null);
      return null;
    }
    const row = ((data as Status[] | null) ?? [])[0] ?? null;
    setStatus(row);
    return row;
  }, []);

  const listCalendars = useCallback(async () => {
    setBusy("Loading your calendars…");
    try {
      const body = (await (await fetch("/api/agenda/google/calendars")).json()) as CalendarsResponse;
      if ("error" in body) setError(body.error);
      else setCalendars(body.calendars);
    } catch {
      setError("Couldn't reach the app. Check your connection.");
    }
    setBusy(null);
  }, []);

  useEffect(() => {
    // Back from Google's consent screen: ?google=pick, or ?google_error=…
    const params = new URLSearchParams(window.location.search);
    const returned = params.get("google");
    const failure = params.get("google_error");
    if (returned || failure) window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query string only exists in the browser
    if (failure) setError(failure);
    void load().then((row) => {
      if (row && (returned === "pick" || !row.calendar_name)) void listCalendars();
    });
  }, [load, listCalendars]);

  async function pick(calendar: Calendar) {
    setBusy(`Syncing with “${calendar.name}”… This can take a minute the first time.`);
    setError(null);
    try {
      const response = await fetch("/api/agenda/google/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId: calendar.id }),
      });
      const body = (await response.json().catch(() => ({ error: "The server didn't answer." }))) as { ok?: true; error?: string };
      if (body.error) setError(body.error);
      if (body.ok) setCalendars(null);
    } catch {
      setError("Couldn't reach the app. Check your connection.");
    }
    setBusy(null);
    await load();
  }

  async function syncNow() {
    setBusy("Syncing…");
    setError(null);
    const body = (await fetch("/api/agenda/sync", { method: "POST" })
      .then((r) => r.json())
      .catch(() => ({ error: "Couldn't reach the app. Check your connection." }))) as { error?: string };
    if (body.error) setError(body.error);
    setBusy(null);
    await load();
  }

  async function disconnect() {
    if (!window.confirm("Stop syncing with Google Calendar? Nothing is deleted from Agenda or from Google.")) return;
    setBusy("Disconnecting…");
    await fetch("/api/agenda/google/disconnect", { method: "POST" }).catch(() => {});
    setCalendars(null);
    setBusy(null);
    await load();
  }

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-xl">Google Calendar</h2>
        <p className="text-sm text-muted">
          Everything dated in Agenda is kept in one shared Google calendar, so it shows up in your calendar apps. Shared by both of you; set up once.
        </p>
      </div>

      {status === undefined && <p className="text-muted">Loading…</p>}

      {status === null && (
        <>
          <p className="text-sm text-muted">
            Sign in with the Google account that owns the Casa calendar. Create a calendar called &ldquo;Casa&rdquo; in Google Calendar first and share it with the
            other person with permission to make changes.
          </p>
          <a href="/api/agenda/google/connect" className={ui.primary}>
            Connect Google Calendar
          </a>
        </>
      )}

      {status && (
        <>
          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted">Account</dt>
              <dd className="min-w-0 truncate">{status.google_account ?? "Connected"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted">Calendar</dt>
              <dd className="min-w-0 truncate">{status.calendar_name ?? "Not picked yet"}</dd>
            </div>
            {status.calendar_name && (
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-muted">Synced</dt>
                <dd>
                  {status.last_sync_at ? when(status.last_sync_at) : "Not yet"}
                  {!status.live && " · changes in Google show up when Agenda is opened"}
                </dd>
              </div>
            )}
          </dl>
          {status.last_error && <p className={ui.error}>{status.last_error}</p>}

          {calendars && (
            <div className="flex flex-col gap-2">
              <p className="font-semibold">Which calendar is the Casa calendar?</p>
              {calendars.length === 0 && <p className="text-sm text-muted">This account has no calendars Casa can change.</p>}
              {calendars.map((c) => (
                <button key={c.id} type="button" disabled={Boolean(busy)} onClick={() => void pick(c)} className={`${ui.secondary} justify-start`}>
                  {c.name}
                  {c.primary && <span className="text-sm font-normal text-muted">(main calendar)</span>}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {status.calendar_name && (
              <button type="button" disabled={Boolean(busy)} onClick={() => void syncNow()} className={ui.secondary}>
                Sync now
              </button>
            )}
            {status.calendar_name && !calendars && (
              <button type="button" disabled={Boolean(busy)} onClick={() => void listCalendars()} className={ui.secondary}>
                Change calendar
              </button>
            )}
            <button type="button" disabled={Boolean(busy)} onClick={() => void disconnect()} className={ui.danger}>
              Disconnect
            </button>
          </div>
        </>
      )}

      {busy && <p className="text-sm text-muted">{busy}</p>}
      {error && <p className={ui.error}>{error}</p>}
    </section>
  );
}
