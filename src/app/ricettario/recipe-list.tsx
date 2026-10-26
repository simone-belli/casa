"use client";

import { SafeLink } from "@/components/safe-link";
import { useEffect, useMemo, useState } from "react";
import { ui } from "@/components/ui";
import { useDeviceSetting } from "@/lib/device-setting";
import { useHotMonths, useHousehold } from "@/lib/household";
import { listRecipes, watchRecipes } from "@/lib/recipes/db";
import { type Course, LABEL_NAMES, tagName } from "@/lib/recipes/labels";
import { currentSeason, filterMenu, MENU } from "@/lib/recipes/menu";
import { searchRecipes } from "@/lib/recipes/search";
import type { Recipe } from "@/lib/recipes/types";
import { timeAgo } from "./time";

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState<Course | null>(null);
  // The tick boxes are remembered on this phone.
  const [vegetarian, setVegetarian] = useDeviceSetting("ricettario.vegetarian", false);
  const [inSeason, setInSeason] = useDeviceSetting("ricettario.in-season", false);
  const hotMonths = useHotMonths();
  const season = hotMonths ? currentSeason(hotMonths) : null;
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

  const results = useMemo(
    () => (recipes ? searchRecipes(filterMenu(recipes, { course, vegetarian, season: inSeason ? season : null }), query) : []),
    [recipes, course, vegetarian, inSeason, season, query],
  );
  const filtered = course !== null || vegetarian || inSeason;
  const toggle = "flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold";

  return (
    <div className="flex flex-col gap-4 pt-4">
      <section aria-labelledby="menu-title" className="flex flex-col gap-3">
        <h2 id="menu-title" className="font-display text-2xl">
          What shall we eat?
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {MENU.map((item) => {
            const on = course === item.tag;
            return (
              <button
                key={item.tag}
                type="button"
                aria-pressed={on}
                onClick={() => setCourse(on ? null : item.tag)}
                className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-center text-xs leading-tight font-semibold shadow-sm active:scale-[0.97] ${on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
              >
                <span className="text-2xl" aria-hidden>
                  {item.icon}
                </span>
                {item.name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`${toggle} ${vegetarian ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink"}`}>
            <input type="checkbox" checked={vegetarian} onChange={() => setVegetarian(!vegetarian)} className="h-4 w-4 accent-brand" />
            Vegetarian
          </label>
          <label className={`${toggle} ${inSeason ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink"}`}>
            <input type="checkbox" checked={inSeason} onChange={() => setInSeason(!inSeason)} className="h-4 w-4 accent-brand" />
            In season
            {season && <span className="font-normal text-muted">({season === "hot-season" ? "☀️ hot" : "❄️ cold"})</span>}
          </label>
        </div>
        {recipes && recipes.length > 0 && (
          <SafeLink href="/ricettario/sort" className="self-start text-sm text-brand underline underline-offset-4">
            ✨ Sort recipes into the menu with Claude
          </SafeLink>
        )}
      </section>

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

      {recipes && recipes.length > 0 && filtered && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <p>
            {[course && LABEL_NAMES[course], vegetarian && "vegetarian", inSeason && "in season"].filter(Boolean).join(" · ")}
            {" · "}
            {results.length === 1 ? "1 recipe" : `${results.length} recipes`}
          </p>
          <button
            type="button"
            onClick={() => {
              setCourse(null);
              setVegetarian(false);
              setInSeason(false);
            }}
            className="shrink-0 underline underline-offset-4"
          >
            Show all
          </button>
        </div>
      )}

      {recipes && recipes.length > 0 && results.length === 0 && (
        <p className="py-10 text-center text-muted">
          {query.trim()
            ? `Nothing matches “${query}”.`
            : "No recipes match yet. Tick the menu, diet and season boxes when adding or editing a recipe to have it show up here."}
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
  );
}
