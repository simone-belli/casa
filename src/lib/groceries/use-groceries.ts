"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DuplicateNameError, loadGroceries, watchGroceries } from "./db";
import type { Groceries } from "./types";

/** How long to wait for a burst of live changes to settle before reloading. */
const RELOAD_DELAY_MS = 250;

/**
 * All Groceries data, kept live. `change` applies an edit on screen straight
 * away, then saves it; if saving fails the screen goes back to the saved
 * state and `error` says why.
 */
export function useGroceries() {
  const [data, setData] = useState<Groceries | null>(null);
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
      loadGroceries().then(
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
    // Live updates pause while the phone is locked; catch up when it's back.
    const unwatch = watchGroceries(reload);
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unwatch();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer.current);
    };
  }, [reload]);

  const change = useCallback(
    async (edit: ((current: Groceries) => Groceries) | null, save: () => Promise<unknown>): Promise<boolean> => {
      if (edit) setData((current) => (current ? edit(current) : current));
      setError(null);
      saving.current++;
      try {
        await save();
        return true;
      } catch (e) {
        setError(e instanceof DuplicateNameError ? e.message : "Couldn't save that. Check your connection and try again.");
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
