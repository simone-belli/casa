"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSavedCopy, writeSavedCopy, type SavedCopyName } from "@/lib/saved-copy";
import { editFailed, editSaved, editStarted, initialSyncState, loaded, restored, shown, type SyncState } from "./sync-state";

/** How long to wait for a burst of live changes to settle before reloading. */
const RELOAD_DELAY_MS = 250;

export const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

type Options<T> = {
  /** Where the copy shown at opening is kept on the phone. */
  name: SavedCopyName;
  load: () => Promise<T>;
  /** Calls back whenever anything changes, by either person. Returns how to stop. */
  watch: (onChange: () => void) => () => void;
  /** Called after each successful save. */
  onSaved?: () => void;
  /** The message to show when saving fails. */
  errorMessage?: (error: unknown) => string;
};

/**
 * A section's shared data, kept live on both phones. `change` shows an edit
 * straight away, then saves it; the other person's changes keep arriving
 * meanwhile without undoing it (see sync-state.ts). If saving fails the edit
 * comes off the screen and `error` says why.
 */
export function useLiveData<T>({ name, load, watch, onSaved, errorMessage }: Options<T>) {
  const [state, setState] = useState<SyncState<T>>(initialSyncState);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadsStarted = useRef(0);
  const editsStarted = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  // Read at call time, so callers can pass fresh functions each render.
  const options = useRef({ name, load, watch, onSaved, errorMessage });
  useEffect(() => {
    options.current = { name, load, watch, onSaved, errorMessage };
  });

  const reload = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const number = ++loadsStarted.current;
      options.current.load().then(
        (next) => {
          setState((s) => loaded(s, number, next));
          setLoadFailed(false);
          // Only ever the newest load's data, never an older one's.
          if (number === loadsStarted.current) writeSavedCopy(options.current.name, next);
        },
        () => setLoadFailed(true),
      );
    }, RELOAD_DELAY_MS);
  }, []);

  useEffect(() => {
    // Show what was here last time straight away; the load below replaces it.
    const saved = readSavedCopy<T>(options.current.name);
    if (saved) setState((s) => restored(s, saved));
    reload();
    const unwatch = options.current.watch(reload);
    // Live updates pause while the phone is locked; catch up when it's back.
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unwatch();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer.current);
    };
  }, [reload]);

  const change = useCallback(
    async (edit: ((current: T) => T) | null, save: () => Promise<unknown>): Promise<boolean> => {
      const id = ++editsStarted.current;
      if (edit) setState((s) => editStarted(s, { id, apply: edit, savedAfterLoad: null }));
      setError(null);
      try {
        await save();
        setState((s) => editSaved(s, id, loadsStarted.current));
        options.current.onSaved?.();
        return true;
      } catch (e) {
        setState((s) => editFailed(s, id));
        setError(options.current.errorMessage?.(e) ?? SAVE_FAILED);
        return false;
      } finally {
        reload();
      }
    },
    [reload],
  );

  const data = useMemo(() => shown(state), [state]);
  const clearError = useCallback(() => setError(null), []);
  return { data, loadFailed, error, clearError, change };
}
