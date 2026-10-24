"use client";

import { SafeLink } from "@/components/safe-link";
import { useEffect, useMemo, useState } from "react";
import { ui } from "@/components/ui";
import { useHousehold } from "@/lib/household";
import { listRecipes, watchRecipes } from "@/lib/recipes/db";
import { searchRecipes } from "@/lib/recipes/search";
import type { Recipe } from "@/lib/recipes/types";
import { timeAgo } from "./time";

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const { nameOf } = useHousehold();

  useEffect(() => {
    const load = () =>
      listRecipes().then(
        (list) => {
          setRecipes(list);
          setFailed(false);
        },
        () => setFailed(true),
      );
    void load();
    // Reload on any change by either person, and when the app comes back to
    // the foreground (live updates pause while the phone is locked).
    const unwatch = watchRecipes(() => void load());
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      unwatch();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const results = useMemo(() => (recipes ? searchRecipes(recipes, query) : []), [recipes, query]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <input
        type="search"
        placeholder="Search recipes, ingredients, tags…"
        aria-label="Search recipes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`${ui.input} rounded-full px-4`}
      />

      {failed && <p className={ui.error}>Couldn&apos;t load recipes. Check your connection.</p>}
      {!recipes && !failed && <p className="py-10 text-center text-muted">Loading…</p>}

      {recipes && recipes.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="font-display text-2xl">No recipes yet</p>
          <p className="max-w-xs text-muted">Add the first one by typing it, snapping a notebook page or pasting a link.</p>
          <SafeLink href="/ricettario/new" className={ui.primary}>
            + Add a recipe
          </SafeLink>
        </div>
      )}

      {recipes && recipes.length > 0 && results.length === 0 && (
        <p className="py-10 text-center text-muted">Nothing matches “{query}”.</p>
      )}

      <ul className="flex flex-col gap-3">
        {results.map((recipe) => {
          const by = nameOf(recipe.updated_by);
          return (
            <li key={recipe.id}>
              <SafeLink href={`/ricettario/${recipe.id}`} prefetch={false} className={`${ui.card} block active:bg-bg`}>
                <p className="font-display text-xl leading-snug">{recipe.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {recipe.kind === "batch" ? recipe.yield || "Batch" : `${recipe.ingredients.length} ingredients`}
                  {" · "}
                  {by ? `${by}, ` : ""}
                  {timeAgo(recipe.updated_at)}
                </p>
                {recipe.tags.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {recipe.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                        {tag}
                      </span>
                    ))}
                  </p>
                )}
              </SafeLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
