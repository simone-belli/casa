/**
 * The last data each section loaded, kept on this phone, so a section can
 * show it the moment it opens and then replace it with fresh data from the
 * server. Live updates already swap data in like this, so a stale copy only
 * lasts until the first load comes back.
 *
 * Bump VERSION whenever the shape of saved data changes, so old copies are
 * ignored rather than read as the new shape.
 */
const VERSION = 1;
const PREFIX = "casa:saved:";
const keyFor = (name: string) => `${PREFIX}v${VERSION}:${name}`;

export type SavedCopyName = "groceries" | "agenda" | "recipes" | "household";

/** The saved copy, or null if there's none (or storage is blocked). */
export function readSavedCopy<T>(name: SavedCopyName): T | null {
  try {
    const stored = window.localStorage.getItem(keyFor(name));
    return stored === null ? null : (JSON.parse(stored) as T);
  } catch {
    return null;
  }
}

/** Saves a copy; if the phone refuses (full, private browsing), carries on without one. */
export function writeSavedCopy(name: SavedCopyName, value: unknown): void {
  try {
    window.localStorage.setItem(keyFor(name), JSON.stringify(value));
  } catch {
    // No saved copy: the section just loads as before next time.
  }
}

/** Forgets every saved copy, e.g. on signing out, so the next person doesn't see them. */
export function clearSavedCopies(): void {
  try {
    const storage = window.localStorage;
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Nothing saved, or storage is blocked.
  }
}
