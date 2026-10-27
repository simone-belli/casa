"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { createItem, updateItem } from "@/lib/groceries/db";
import { amountByDefault, findItem, planPurchase, shoppingAmount } from "@/lib/groceries/from-recipe";
import { useGroceries } from "@/lib/groceries/use-groceries";
import type { Ingredient } from "@/lib/recipes/types";

type Props = {
  ingredients: Ingredient[];
  /** The scaling factor the recipe is shown at, so amounts match the screen. */
  factor: number;
  onClose: () => void;
};

type Row = { ticked: boolean; withAmount: boolean };

/**
 * Pick which of a recipe's ingredients we need to buy, with or without their
 * amounts, and add them to the Groceries list.
 */
export function BuyIngredients({ ingredients, factor, onClose }: Props) {
  const { data, loadFailed, error, change } = useGroceries();
  const [rows, setRows] = useState<Row[]>(() => ingredients.map((i) => ({ ticked: false, withAmount: amountByDefault(i) })));
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const ticked = rows.filter((r) => r.ticked).length;
  const set = (index: number, row: Partial<Row>) => setRows((all) => all.map((r, i) => (i === index ? { ...r, ...row } : r)));

  async function done() {
    if (!data || ticked === 0) return;
    setSaving(true);
    const plan = planPurchase(
      data.items,
      ingredients.flatMap((ingredient, i) =>
        rows[i].ticked ? [{ name: ingredient.name, amount: rows[i].withAmount ? shoppingAmount(ingredient, factor) : null }] : [],
      ),
    );
    const saved = await change(null, () =>
      Promise.all([
        ...plan.update.map(({ id, amount }) => updateItem(id, { status: "need", amount })),
        ...plan.create.map(({ name, amount }) => createItem({ name, amount, status: "need", is_one_off: false })),
      ]),
    );
    setSaving(false);
    if (saved) setAdded(plan.update.length + plan.create.length);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buy ingredients"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
      >
        <header>
          <h2 className="font-display text-2xl">Buy ingredients</h2>
          {added === null && (
            <p className="text-sm text-muted">Tick what we need to buy. Tap an amount to leave it off the list.</p>
          )}
        </header>

        {added !== null ? (
          <>
            <p>
              {added === 1 ? "1 item is" : `${added} items are`} on the Groceries list now.
            </p>
            <div className="flex flex-wrap gap-3">
              <SafeLink href="/groceries" className={`${ui.primary} flex-1`}>
                Open Groceries
              </SafeLink>
              <button type="button" onClick={onClose} className={ui.secondary}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            {!data && <p className={loadFailed ? ui.error : "text-muted"}>{loadFailed ? "Couldn't load the Groceries list. Check your connection." : "Loading…"}</p>}
            {data && (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {ingredients.map((ingredient, i) => {
                  const row = rows[i];
                  const amount = shoppingAmount(ingredient, factor);
                  const item = findItem(data.items, ingredient.name);
                  const status = !item ? "New to Groceries" : item.status === "need" ? "Already on the list" : "Groceries says we have it";
                  return (
                    <li key={i} className="flex items-center gap-3 px-3 py-2">
                      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={row.ticked}
                          onChange={(e) => set(i, { ticked: e.target.checked })}
                          className="h-5 w-5 shrink-0 accent-brand"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{ingredient.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {status}
                            {item?.status === "need" && item.amount && ` (${item.amount})`}
                          </span>
                        </span>
                      </label>
                      {amount && (
                        <button
                          type="button"
                          aria-pressed={row.ticked && row.withAmount}
                          aria-label={`Amount for ${ingredient.name}: ${amount}`}
                          // On a row not ticked yet, the amount ticks it, with the amount.
                          onClick={() => set(i, row.ticked ? { withAmount: !row.withAmount } : { ticked: true, withAmount: true })}
                          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums ${
                            row.withAmount && row.ticked
                              ? "border-brand bg-brand text-brand-ink"
                              : `border-line bg-surface text-muted ${row.ticked ? "line-through" : ""}`
                          }`}
                        >
                          {amount}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {error && <p className={ui.error}>{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void done()} disabled={!data || saving || ticked === 0} className={`${ui.primary} flex-1`}>
                {saving ? "Adding…" : ticked === 0 ? "Done" : `Done: add ${ticked} to Groceries`}
              </button>
              <button type="button" onClick={onClose} className={ui.secondary}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
