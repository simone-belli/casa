"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stepper } from "@/components/stepper";
import { ui } from "@/components/ui";
import { useFamilyDefaults, useHousehold } from "@/lib/household";
import { deleteRecipe } from "@/lib/recipes/db";
import { formatAmount } from "@/lib/recipes/format";
import { BATCH_MULTIPLIERS, portionsFor, scaleQuantity } from "@/lib/recipes/scaling";
import type { Recipe } from "@/lib/recipes/types";
import { RicettarioHeader } from "../header";
import { PhotoStrip } from "../photo-strip";
import { timeAgo } from "../time";
import { useRecipe } from "./use-recipe";

const back = { href: "/ricettario", label: "Back to recipes" };

export function RecipeView() {
  const { state } = useRecipe({ live: true });

  if (state.status !== "ready") {
    return (
      <>
        <RicettarioHeader title="Recipe" back={back} />
        <p className="px-4 py-12 text-center text-muted">
          {state.status === "loading" && "Loading…"}
          {state.status === "missing" && "This recipe was deleted."}
          {state.status === "error" && "Couldn't load the recipe. Check your connection."}
        </p>
      </>
    );
  }
  return <RecipeDetails recipe={state.recipe} />;
}

function RecipeDetails({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const { nameOf } = useHousehold();
  const family = useFamilyDefaults();
  // Scaling is a temporary view adjustment: kept in local state, never saved.
  const [people, setPeople] = useState<{ adults: number; children: number } | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const adults = people?.adults ?? family?.default_adults ?? 2;
  const children = people?.children ?? family?.default_children ?? 2;
  const factor = recipe.kind === "portion" ? portionsFor(adults, children) : multiplier;
  const updatedBy = nameOf(recipe.updated_by);

  async function remove() {
    if (!window.confirm(`Delete “${recipe.title}”? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteRecipe(recipe);
      router.replace("/ricettario");
    } catch {
      setDeleting(false);
      window.alert("Couldn't delete the recipe. Check your connection.");
    }
  }

  return (
    <>
      <RicettarioHeader
        title="Recipe"
        back={back}
        action={
          <Link href={`/ricettario/${recipe.id}/edit`} className="rounded-full bg-white px-4 py-2 font-semibold text-brand active:opacity-80">
            Edit
          </Link>
        }
      />
      <article className="flex flex-col gap-5 px-4 pt-5">
        <header>
          <h2 className="font-display text-3xl leading-tight">{recipe.title}</h2>
          {recipe.kind === "batch" && recipe.yield && <p className="mt-1 text-muted">Makes {recipe.yield}</p>}
          {recipe.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {recipe.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
                  {tag}
                </span>
              ))}
            </p>
          )}
        </header>

        {recipe.notes && <p className="whitespace-pre-wrap rounded-2xl bg-brand/5 p-4 text-ink italic">{recipe.notes}</p>}

        <section className={`${ui.card} flex flex-col gap-3`}>
          {recipe.kind === "portion" ? (
            <>
              <Stepper label="Adults" value={adults} onChange={(v) => setPeople({ adults: v, children })} />
              <Stepper label="Children" value={children} onChange={(v) => setPeople({ adults, children: v })} />
              <p className="text-sm text-muted">
                {factor} {factor === 1 ? "portion" : "portions"}
                {factor === 0 && " — add someone to see the amounts"}
              </p>
            </>
          ) : (
            <div>
              <p className={ui.label}>Batches</p>
              <div className="grid grid-cols-5 gap-2">
                {BATCH_MULTIPLIERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={multiplier === m}
                    onClick={() => setMultiplier(m)}
                    className={`min-h-11 rounded-xl border font-semibold ${multiplier === m ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-display text-2xl">Ingredients</h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {recipe.ingredients.map((ingredient, i) => {
              const amount = formatAmount(scaleQuantity(ingredient, factor), ingredient.unit);
              return (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-brand">{amount}</span>
                  <span className="min-w-0">
                    {ingredient.name}
                    {ingredient.note && <span className="text-muted">, {ingredient.note}</span>}
                    {ingredient.quantity === null && !ingredient.note && <span className="text-muted">, to taste</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 font-display text-2xl">Method</h3>
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-display font-bold text-brand-ink">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed whitespace-pre-wrap">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {(recipe.photo_paths.length > 0 || recipe.source_url || recipe.source_text) && (
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-2xl">Source</h3>
            <PhotoStrip paths={recipe.photo_paths} />
            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" rel="noreferrer" className="break-all text-sm text-brand underline">
                {recipe.source_url}
              </a>
            )}
            {recipe.source_text && (
              <details className="text-sm">
                <summary className="text-muted">Original text</summary>
                <p className="mt-2 whitespace-pre-wrap">{recipe.source_text}</p>
              </details>
            )}
          </section>
        )}

        <footer className="flex flex-col items-center gap-4 border-t border-line pt-5 pb-4 text-sm text-muted">
          <p>
            Updated {timeAgo(recipe.updated_at)}
            {updatedBy && ` by ${updatedBy}`}
          </p>
          <button type="button" onClick={remove} disabled={deleting} className={ui.danger}>
            {deleting ? "Deleting…" : "Delete recipe"}
          </button>
        </footer>
      </article>
    </>
  );
}
