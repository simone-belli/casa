"use client";

import { useLiveData, SAVE_FAILED } from "@/lib/live/use-live-data";
import { DuplicateNameError, loadGroceries, watchGroceries } from "./db";
import type { Groceries } from "./types";

const errorMessage = (e: unknown) => (e instanceof DuplicateNameError ? e.message : SAVE_FAILED);

/**
 * All Groceries data, kept live. `change` applies an edit on screen straight
 * away, then saves it; the other person's changes keep arriving meanwhile
 * without undoing it. If saving fails the edit comes off the screen and
 * `error` says why.
 */
export function useGroceries() {
  return useLiveData<Groceries>({ name: "groceries", load: loadGroceries, watch: watchGroceries, errorMessage });
}
