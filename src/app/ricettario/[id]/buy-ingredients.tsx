"use client";

import { useRef, useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { createItem, fileItems, setItemPlaces, updateItem } from "@/lib/groceries/db";
import {
  amountByDefault,
  combineAmounts,
  findItem,
  planPurchase,
  type Pick,
  sameIngredient,
  shoppingAmount,
  similarItems,
} from "@/lib/groceries/from-recipe";
import { NOT_SOLD } from "@/lib/groceries/types";
import { useGroceries } from "@/lib/groceries/use-groceries";
import type { Ingredient } from "@/lib/recipes/types";
import { uid } from "@/lib/uid";
import { NewIngredient, newItem, type Resolution } from "./new-ingredient";

type Props = {
  ingredients: Ingredient[];
  /** The scaling factor the recipe is shown at, so amounts match the screen. */
  factor: number;
  onClose: () => void;
};

type Row = { ticked: boolean; withAmount: boolean };

/** Ticked ingredients Groceries doesn't know, merged by name ("egg" and "eggs"). */
type Unknown = { name: string; picks: Pick[] };

/**
 * Pick which of a recipe's ingredients we need to buy, with or without their
 * amounts, and add them to the Groceries list.
 */
export function BuyIngredients({ ingredients, factor, onClose }: Props) {
  const { data, loadFailed, error, change } = useGroceries();
  const [rows, setRows] = useState<Row[]>(() => ingredients.map((i) => ({ ticked: false, withAmount: amountByDefault(i) })));
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  // After Done: the ingredients new to Groceries, asked about one at a time.
  const [unknowns, setUnknowns] = useState<Unknown[] | null>(null);
  const [resolutions, setResolutions] = useState<(Resolution | null)[]>([]);
  const [asking, setAsking] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const ask = (index: number) => {
    setAsking(index);
    sheet.current?.scrollTo({ top: 0 });
  };

  const ticked = rows.filter((r) => r.ticked).length;
  const set = (index: number, row: Partial<Row>) => setRows((all) => all.map((r, i) => (i === index ? { ...r, ...row } : r)));

  const picks = (): Pick[] =>
    ingredients.flatMap((ingredient, i) =>
      rows[i].ticked ? [{ name: ingredient.name.trim(), amount: rows[i].withAmount ? shoppingAmount(ingredient, factor) : null }] : [],
    );

  /** Done on the checklist: save, or first ask about the ingredients new to Groceries. */
  function done() {
    if (!data || ticked === 0) return;
    const found: Unknown[] = [];
    for (const pick of picks()) {
      if (!pick.name || findItem(data.items, pick.name)) continue;
      const same = found.find((u) => sameIngredient(u.name, pick.name));
      if (same) same.picks.push(pick);
      else found.push({ name: pick.name, picks: [pick] });
    }
    if (found.length === 0) return void save([], []);
    setUnknowns(found);
    // With nothing similar in Groceries it's most likely new; otherwise ask.
    setResolutions(found.map((u) => (similarItems(data.items, u.name).length === 0 ? newItem(u.name) : null)));
    ask(0);
  }

  async function save(asked: Unknown[], answers: (Resolution | null)[]) {
    if (!data) return;
    const isNew = (name: string) => asked.findIndex((u) => sameIngredient(u.name, name));
    // Known items, and the ones we were told an unknown ingredient is.
    const known = picks().flatMap((pick): Pick[] => {
      if (findItem(data.items, pick.name)) return [pick];
      const index = isNew(pick.name);
      if (index === -1) return [pick];
      const answer = answers[index];
      return answer?.kind === "existing" ? [{ ...pick, itemId: answer.itemId }] : [];
    });
    const plan = planPurchase(data.items, known);
    const created = asked.flatMap((unknown, index) => {
      const answer = answers[index];
      if (answer?.kind !== "new" || !answer.name.trim()) return [];
      return [{ ...answer, id: uid(), amount: unknown.picks.reduce<string | null>((sum, p) => combineAmounts(sum, p.amount), null) }];
    });

    setSaving(true);
    const saved = await change(null, () =>
      Promise.all([
        ...plan.update.map(({ id, amount }) => updateItem(id, { status: "need", amount })),
        ...plan.create.map(({ name, amount }) => createItem({ name, amount, status: "need", is_one_off: false })),
        ...created.map(async (item) => {
          await createItem({ id: item.id, name: item.name, amount: item.amount, status: "need", is_one_off: item.isOneOff });
          if (item.isOneOff) return;
          if (item.places.length > 0) await setItemPlaces(item.id, item.places);
          await fileItems(
            Object.entries(item.aisles)
              .filter(([, choice]) => choice)
              .map(([store_id, choice]) => ({ item_id: item.id, store_id, aisle_id: choice === NOT_SOLD ? null : choice })),
            false,
          );
        }),
      ]),
    );
    setSaving(false);
    if (saved) setAdded(plan.update.length + plan.create.length + created.length);
  }

  const answer = resolutions[asking];
  const answered = answer?.kind === "existing" || (answer?.kind === "new" && Boolean(answer.name.trim()));

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buy ingredients"
        ref={sheet}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
      >
        <header>
          <h2 className="font-display text-2xl">Buy ingredients</h2>
          {added === null && !unknowns && (
            <p className="text-sm text-muted">Tick what we need to buy. Tap an amount to leave it off the list.</p>
          )}
          {added === null && unknowns && (
            <p className="text-sm text-muted">
              New to Groceries{unknowns.length > 1 && ` · ${asking + 1} of ${unknowns.length}`}
            </p>
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
        ) : unknowns && data ? (
          <>
            <p className="font-display text-xl">{unknowns[asking].name}</p>
            <NewIngredient
              key={asking}
              name={unknowns[asking].name}
              data={data}
              value={answer}
              onChange={(value) => setResolutions((all) => all.map((r, i) => (i === asking ? value : r)))}
            />
            {error && <p className={ui.error}>{error}</p>}
            <div className="flex flex-wrap gap-3">
              {asking < unknowns.length - 1 ? (
                <button type="button" onClick={() => ask(asking + 1)} disabled={!answered} className={`${ui.primary} flex-1`}>
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void save(unknowns, resolutions)}
                  disabled={!answered || saving}
                  className={`${ui.primary} flex-1`}
                >
                  {saving ? "Adding…" : "Add to Groceries"}
                </button>
              )}
              <button
                type="button"
                onClick={() => (asking > 0 ? ask(asking - 1) : setUnknowns(null))}
                className={ui.secondary}
              >
                Back
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
              <button type="button" onClick={done} disabled={!data || saving || ticked === 0} className={`${ui.primary} flex-1`}>
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
