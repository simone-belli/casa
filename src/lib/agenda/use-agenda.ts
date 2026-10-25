"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHousehold } from "@/lib/household";
import { loadAgenda, loadMySettings, saveMySettings, watchAgenda } from "./db";
import { deviceTimeZone, todayIn } from "./time";
import type { Agenda, AgendaSettings } from "./types";
import type { Viewer } from "./views";

/** How long to wait for a burst of live changes to settle before reloading. */
const RELOAD_DELAY_MS = 250;

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

/**
 * All Agenda data, kept live. `change` applies an edit on screen straight
 * away, then saves it; if saving fails the screen goes back to the saved
 * state and `error` says why.
 */
export function useAgenda() {
  const [data, setData] = useState<Agenda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // While a save is in flight, a reload could bring back the old state and
  // undo the change on screen; reload once the last save has finished.
  const saving = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const reload = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (saving.current > 0) return;
      loadAgenda().then(
        (next) => {
          if (saving.current > 0) return;
          setData(next);
          setLoadFailed(false);
        },
        () => setLoadFailed(true),
      );
    }, RELOAD_DELAY_MS);
  }, []);

  useEffect(() => {
    reload();
    // A safety net in case a change notification from Google was missed.
    requestSync(0);
    // Live updates pause while the phone is locked; catch up when it's back.
    const unwatch = watchAgenda(reload);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      reload();
      requestSync(0);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unwatch();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer.current);
    };
  }, [reload]);

  const change = useCallback(
    async (edit: ((current: Agenda) => Agenda) | null, save: () => Promise<unknown>): Promise<boolean> => {
      if (edit) setData((current) => (current ? edit(current) : current));
      setError(null);
      saving.current++;
      try {
        await save();
        requestSync();
        return true;
      } catch (e) {
        const message = String((e as { message?: unknown } | null)?.message ?? "");
        setError(
          message.includes("already been answered")
            ? "That proposal has already been answered or withdrawn."
            : "Couldn't save that. Check your connection and try again.",
        );
        return false;
      } finally {
        saving.current--;
        reload();
      }
    },
    [reload],
  );

  return { data, loadFailed, error, clearError: () => setError(null), change };
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
