"use client";

import { useEffect, useState } from "react";
import type { LabelResponse } from "@/app/api/ricettario/label/route";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { mapLimited } from "@/lib/map-limited";
import { listRecipes, updateTags } from "@/lib/recipes/db";
import { isSorted, type Label, LABEL_NAMES, MEALS, MENU_LABELS, withSuggestedLabels } from "@/lib/recipes/labels";
import { RECIPES_PER_REQUEST } from "@/lib/recipes/menu";
import type { Recipe } from "@/lib/recipes/types";

/** Requests to Claude, and saves, running at once. */
const REQUESTS_AT_ONCE = 2;
const SAVES_AT_ONCE = 4;

const isMeal = (label: Label) => (MEALS as readonly string[]).includes(label);

type Suggestion = { recipe: Recipe; meals: Label[]; labels: Label[] };

/**
 * Asks Claude to suggest the menu, diet and season labels of recipes, then
 * shows them for review; nothing is saved until the person confirms.
 */
export function SortRecipes() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [phase, setPhase] = useState<"choose" | "working" | "review" | "saving" | "done">("choose");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRecipes().then(setRecipes, () => setError("Couldn't load recipes. Check your connection."));
  }, []);

  if (!recipes) return <p className="py-10 text-center text-muted">{error ?? "Loading…"}</p>;

  const unsorted = recipes.filter((r) => !isSorted(r.tags));

  async function sort(list: Recipe[]) {
    setPhase("working");
    setError(null);
    setProgress({ done: 0, total: list.length });
    const chunks: Recipe[][] = [];
    for (let i = 0; i < list.length; i += RECIPES_PER_REQUEST) chunks.push(list.slice(i, i + RECIPES_PER_REQUEST));
    let failure: string | null = null;
    const results = await mapLimited(chunks, REQUESTS_AT_ONCE, async (chunk) => {
      try {
        const response = await fetch("/api/ricettario/label", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: chunk.map((r) => r.id) }),
        });
        const body = (await response.json().catch(() => ({ error: "The server didn't answer properly." }))) as LabelResponse;
        if ("error" in body) {
          failure = body.error;
          return [];
        }
        return body.suggestions;
      } catch {
        failure = "Couldn't reach the server. Check your connection and try again.";
        return [];
      } finally {
        setProgress((p) => ({ ...p, done: Math.min(p.total, p.done + chunk.length) }));
      }
    });
    const byId = new Map(results.flat().map((s) => [s.id, s.labels]));
    const found = list.flatMap((recipe) => {
      const labels = byId.get(recipe.id);
      return labels ? [{ recipe, meals: labels.filter(isMeal), labels: labels.filter((l) => !isMeal(l)) }] : [];
    });
    if (found.length < list.length) {
      setError(
        found.length === 0
          ? (failure ?? "Claude didn't sort any recipes. Please try again.")
          : `Claude couldn't sort ${list.length - found.length} of the recipes${failure ? ` (${failure})` : ""}. You can try those again later.`,
      );
    }
    setSuggestions(found);
    setPhase(found.length > 0 ? "review" : "choose");
  }

  function toggle(id: string, label: Label) {
    setSuggestions((list) =>
      list.map((s) =>
        s.recipe.id !== id ? s : { ...s, labels: s.labels.includes(label) ? s.labels.filter((l) => l !== label) : [...s.labels, label] },
      ),
    );
  }

  async function save() {
    setPhase("saving");
    setError(null);
    const failed = (
      await mapLimited(suggestions, SAVES_AT_ONCE, (s) =>
        updateTags(s.recipe.id, withSuggestedLabels(s.recipe.tags, [...s.meals, ...s.labels])).then(
          () => false,
          () => true,
        ),
      )
    ).filter(Boolean).length;
    if (failed > 0) {
      setError(`Couldn't save ${failed} of the recipes. Check your connection and try again.`);
      setPhase("review");
    } else {
      setPhase("done");
    }
  }

  if (phase === "done") {
    return (
      <div className={`${ui.card} mt-5 flex flex-col gap-4 text-center`}>
        <p className="font-display text-xl">Saved {suggestions.length === 1 ? "1 recipe" : `${suggestions.length} recipes`}</p>
        <p className="text-muted">They now show up in the menu. You can still change any of them with Edit.</p>
        <SafeLink href="/ricettario" className={ui.primary}>
          Back to the menu
        </SafeLink>
      </div>
    );
  }

  if (phase === "review" || phase === "saving") {
    return (
      <div className="flex flex-col gap-4 pt-5">
        <p className="text-muted">Check Claude&apos;s suggestions and tap a box to change it. Nothing is saved until you tap Save.</p>
        {error && <p className={ui.error}>{error}</p>}
        <ul className="flex flex-col gap-3">
          {suggestions.map(({ recipe, labels }) => (
            <li key={recipe.id} className={`${ui.card} flex flex-col gap-3`}>
              <p className="font-display text-xl leading-snug">{recipe.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {MENU_LABELS.map((label) => {
                  const on = labels.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      disabled={phase === "saving"}
                      onClick={() => toggle(recipe.id, label)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-muted"}`}
                    >
                      {LABEL_NAMES[label]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 -mx-4 flex gap-2 bg-bg/95 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <SafeLink href="/ricettario" className={`${ui.secondary} flex-1`}>
            Cancel
          </SafeLink>
          <button type="button" onClick={() => void save()} disabled={phase === "saving"} className={`${ui.primary} flex-[2]`}>
            {phase === "saving" ? "Saving…" : `Save ${suggestions.length === 1 ? "1 recipe" : `${suggestions.length} recipes`}`}
          </button>
        </div>
      </div>
    );
  }

  const working = phase === "working";

  return (
    <div className="flex flex-col gap-4 pt-5">
      <div className={`${ui.card} flex flex-col gap-3`}>
        <p className="font-display text-xl">
          {unsorted.length === 0
            ? "Every recipe is in the menu"
            : `${unsorted.length} of ${recipes.length} ${recipes.length === 1 ? "recipe isn't" : "recipes aren't"} in the menu yet`}
        </p>
        <p className="text-sm text-muted">
          Claude reads each recipe and suggests its menu, diet and season boxes. You check them before anything is saved. Main courses
          that are good all year and have meat get no boxes, so they stay on this list; that&apos;s fine.
        </p>
        <button type="button" disabled={working || unsorted.length === 0} onClick={() => void sort(unsorted)} className={ui.primary}>
          {working ? `Claude is reading… ${progress.done} of ${progress.total}` : `Sort ${unsorted.length === 1 ? "1 recipe" : `${unsorted.length} recipes`}`}
        </button>
        {recipes.length > unsorted.length && (
          <button type="button" disabled={working} onClick={() => void sort(recipes)} className={ui.secondary}>
            Sort all {recipes.length} again
          </button>
        )}
        {working && <p className="text-center text-sm text-muted">This can take a minute or two.</p>}
      </div>
      {error && <p className={ui.error}>{error}</p>}
    </div>
  );
}
