/**
 * How a section's shared data stays right on screen while both phones change
 * it at once.
 *
 * The screen shows the server's data with this phone's own edits laid on top.
 * An edit stays on top while it's being saved, and after: until a load that
 * *started after the save finished* comes back, because only that load is
 * sure to include it. Earlier loads (started by the other person's changes,
 * say) can't undo it on screen; they still bring in everything else.
 *
 * Loads can also come back out of order; one older than the data already
 * shown is ignored.
 *
 * Kept free of React so it can be tested on its own.
 */

/** An edit made on this phone, applied to the server's data to show it. */
export type PendingEdit<T> = {
  id: number;
  apply: (data: T) => T;
  /**
   * Null while saving. Once saved, how many loads had started by then: a
   * load numbered higher started after the save, so it includes the edit.
   */
  savedAfterLoad: number | null;
};

export type SyncState<T> = {
  /** The server's data as last loaded (or the saved copy, until the first load). */
  server: T | null;
  /** The number of the load `server` came from; 0 for none or a saved copy. */
  loadNumber: number;
  pending: PendingEdit<T>[];
};

export const initialSyncState = <T>(): SyncState<T> => ({ server: null, loadNumber: 0, pending: [] });

/** What to show: the server's data with this phone's edits on top. */
export function shown<T>(state: SyncState<T>): T | null {
  if (state.server === null) return null;
  return state.pending.reduce<T>((data, edit) => edit.apply(data), state.server);
}

/** A load (numbered in the order loads started) has come back. */
export function loaded<T>(state: SyncState<T>, loadNumber: number, data: T): SyncState<T> {
  // An older load than what's shown: it can only take things backwards.
  if (loadNumber <= state.loadNumber) return state;
  return {
    server: data,
    loadNumber,
    // Edits this load is sure to include are part of `data` now.
    pending: state.pending.filter((e) => e.savedAfterLoad === null || loadNumber <= e.savedAfterLoad),
  };
}

/** Shows a saved copy from last time, unless real data has already arrived. */
export function restored<T>(state: SyncState<T>, data: T): SyncState<T> {
  return state.server === null ? { ...state, server: data } : state;
}

export function editStarted<T>(state: SyncState<T>, edit: PendingEdit<T>): SyncState<T> {
  return { ...state, pending: [...state.pending, edit] };
}

/** The edit was saved once `loadsStarted` loads had started. */
export function editSaved<T>(state: SyncState<T>, id: number, loadsStarted: number): SyncState<T> {
  return { ...state, pending: state.pending.map((e) => (e.id === id ? { ...e, savedAfterLoad: loadsStarted } : e)) };
}

/** Saving failed: the edit comes off the screen. */
export function editFailed<T>(state: SyncState<T>, id: number): SyncState<T> {
  return { ...state, pending: state.pending.filter((e) => e.id !== id) };
}
