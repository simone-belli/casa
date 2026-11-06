"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/lib/household";
import { loadAgenda, loadMySettings, saveMySettings, watchAgenda } from "./db";
import { deviceTimeZone, todayIn } from "./time";
import type { Agenda, AgendaSettings } from "./types";
import { SAVE_FAILED, useLiveData } from "@/lib/live/use-live-data";
import type { Viewer } from "./views";

/** How long to wait for more changes before asking the server to sync with Google. */
const SYNC_DELAY_MS = 800;
let syncTimer: number | undefined;

/**
 * Asks the server to sync with Google Calendar: changes made here go to
 * Google, and changes made in Google come back (through live updates).
 */
export function requestSync(delay = SYNC_DELAY_MS): void {
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    void fetch("/api/agenda/sync", { method: "POST" }).catch(() => {});
  }, delay);
}

const errorMessage = (e: unknown) =>
  String((e as { message?: unknown } | null)?.message ?? "").includes("already been answered")
    ? "That proposal has already been answered or withdrawn."
    : SAVE_FAILED;

/**
 * All Agenda data, kept live. `change` applies an edit on screen straight
 * away, then saves it; the other person's changes keep arriving meanwhile
 * without undoing it. If saving fails the edit comes off the screen and
 * `error` says why.
 */
export function useAgenda() {
  const live = useLiveData<Agenda>({ name: "agenda", load: loadAgenda, watch: watchAgenda, onSaved: requestSync, errorMessage });

  useEffect(() => {
    // A safety net in case a change notification from Google was missed.
    requestSync(0);
    const onVisible = () => document.visibilityState === "visible" && requestSync(0);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return live;
}

/** Who's looking, in which time zone, and today's date (which moves on at midnight). */
export function useViewer(): Viewer | null {
  const { members, me } = useHousehold();
  // Both come from the phone, so they're read once the page is in the browser.
  const [clock, setClock] = useState<{ timeZone: string; today: string } | null>(null);

  useEffect(() => {
    const timeZone = deviceTimeZone();
    const tick = () => setClock({ timeZone, today: todayIn(timeZone) });
    tick();
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const timeZone = clock?.timeZone;
  const today = clock?.today;
  return useMemo(() => {
    if (!me || !timeZone || !today) return null;
    const other = members.find((m) => m.user_id !== me)?.user_id ?? null;
    return { me, other, timeZone, today };
  }, [me, members, timeZone, today]);
}

/** My Agenda settings (the nudge), with a save that updates the screen straight away. */
export function useMySettings(me: string | null) {
  const [settings, setSettings] = useState<AgendaSettings | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!me) return;
    loadMySettings(me).then(setSettings, () => setFailed(true));
  }, [me]);

  const save = useCallback(async (next: AgendaSettings): Promise<boolean> => {
    setSettings(next);
    try {
      await saveMySettings(next);
      setFailed(false);
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }, []);

  return { settings, failed, save };
}
