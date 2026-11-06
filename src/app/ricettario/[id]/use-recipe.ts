"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getRecipe, watchRecipes } from "@/lib/recipes/db";
import type { Recipe } from "@/lib/recipes/types";
import { readSavedCopy } from "@/lib/saved-copy";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; recipe: Recipe };

/**
 * Loads the recipe in the URL. With `live`, keeps it up to date with the
 * other person's edits; otherwise reports them through `onRemoteChange`.
 */
export function useRecipe(options: { live: boolean; onRemoteChange?: (type: "UPDATE" | "DELETE", recipe: Partial<Recipe>) => void }) {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const { live, onRemoteChange } = options;

  useEffect(() => {
    let cancelled = false;
    // Viewing (not editing), show the copy from the last recipe list straight
    // away; the load below replaces it. An edit form must start from the
    // saved recipe, or saving could undo the other person's changes.
    const saved = live ? readSavedCopy<Recipe[]>("recipes")?.find((r) => r.id === id) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists in the browser
    if (saved) setState({ status: "ready", recipe: saved });
    const load = () =>
      getRecipe(id).then(
        (recipe) => !cancelled && setState(recipe ? { status: "ready", recipe } : { status: "missing" }),
        () => !cancelled && setState({ status: "error" }),
      );
    void load();
    const unwatch = watchRecipes((event) => {
      if (event.type === "INSERT") return;
      if (live) void load();
      else onRemoteChange?.(event.type, event.recipe);
    }, id, () => live && void load());
    const onVisible = () => live && document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      unwatch();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // onRemoteChange is read at event time; re-subscribing on every render isn't wanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, live]);

  return { id, state };
}
