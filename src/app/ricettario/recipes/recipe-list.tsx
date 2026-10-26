"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { useHousehold } from "@/lib/household";
import { listRecipes, watchRecipes } from "@/lib/recipes/db";
import { COURSES, type Course, LABEL_NAMES, tagName } from "@/lib/recipes/labels";
import { filterMenu, MENU } from "@/lib/recipes/menu";
import { searchRecipes } from "@/lib/recipes/search";
import type { Recipe } from "@/lib/recipes/types";
import { RicettarioHeader } from "../header";
import { MenuFilters, rememberList, useMenuFilters } from "../menu-filters";
import { timeAgo } from "../time";

const back = { href: "/ricettario", label: "Back to the menu" };

const isCourse = (value: string | null): value is Course => (COURSES as readonly (string | null)[]).includes(value);

/** The recipes of one menu category (?c=quick), all of them, or a search (?q=…). */
export function RecipeList() {
  const params = useSearchParams();
  const c = params.get("c");
  const course = isCourse(c) ? c : null;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const filters = useMenuFilters();
  const { vegetarian, inSeason, season } = filters;
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

  // A recipe opened from here comes back here.
  useEffect(() => {
    const search = new URLSearchParams();
    if (course) search.set("c", course);
    if (query.trim()) search.set("q", query.trim());
    rememberList(`/ricettario/recipes${search.size ? `?${search}` : ""}`);
  }, [course, query]);

  const results = useMemo(
    () => (recipes ? searchRecipes(filterMenu(recipes, { course, vegetarian, season: inSeason ? season : null }), query) : []),
    [recipes, course, vegetarian, inSeason, season, query],
  );
  const item = MENU.find((m) => m.tag === course);
  const title = item ? `${item.icon} ${item.name}` : "All recipes";
  const narrowed = [vegetarian && "vegetarian", inSeason && "in season"].filter(Boolean).join(" · ");

  return (
    <>
      <RicettarioHeader title={title} back={back} />
      <main className={ui.page}>
        <div className="flex flex-col gap-4 pt-4">
          <input
            type="search"
            enterKeyHint="search"
            placeholder={item ? `Search ${item.name.toLowerCase()} recipes…` : "Search recipes, ingredients, tags…"}
            aria-label="Search recipes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${ui.input} rounded-full px-4`}
          />
          <MenuFilters filters={filters} />

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

          {recipes && recipes.length > 0 && (
            <p className="text-sm text-muted">
              {results.length === 1 ? "1 recipe" : `${results.length} recipes`}
              {narrowed && ` · ${narrowed}`}
            </p>
          )}

          {recipes && recipes.length > 0 && results.length === 0 && (
            <p className="py-10 text-center text-muted">
              {query.trim()
                ? `Nothing matches “${query}”.`
                : `No recipes here yet. Tick ${item ? `“${LABEL_NAMES[item.tag]}”` : "the menu boxes"} when adding or editing a recipe, or sort recipes with Claude in Ricettario's settings.`}
            </p>
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
                            {tagName(tag)}
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
      </main>
    </>
  );
}
