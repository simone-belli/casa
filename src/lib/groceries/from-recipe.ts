import { formatAmount } from "@/lib/recipes/format";
import { scaleQuantity } from "@/lib/recipes/scaling";
import type { Ingredient } from "@/lib/recipes/types";
import type { Item } from "./types";
import { sameName } from "./views";

/** Units whose amount matters when shopping ("600 g" of mince, but just "eggs"). */
const MEASURED_UNITS = new Set(["g", "kg", "ml", "l"]);

/** The ingredient's amount for the shopping list, scaled; null if it has none. */
export function shoppingAmount(ingredient: Ingredient, factor: number): string | null {
  const quantity = scaleQuantity(ingredient, factor);
  if (quantity === null || quantity === 0) return null;
  return formatAmount(quantity, ingredient.unit);
}

/** Whether the amount is kept by default: yes for weights and volumes, not for counts or spoons. */
export function amountByDefault(ingredient: Ingredient): boolean {
  return ingredient.quantity !== null && MEASURED_UNITS.has(ingredient.unit.trim().toLowerCase());
}

/** A name and its possible singulars: "tomatoes" may be "tomatoe" or "tomato". */
function forms(name: string): string[] {
  const n = name.trim();
  return [n, n.replace(/s$/i, ""), n.replace(/es$/i, "")];
}

/** Same name, allowing for plurals: "eggs" and "Egg", "olives" and "olive". */
export function sameIngredient(a: string, b: string): boolean {
  if (sameName(a, b)) return true;
  const fa = forms(a);
  return forms(b).some((x) => fa.some((y) => sameName(x, y)));
}

/** The grocery item an ingredient is, by name, preferring an exact match. */
export function findItem(items: Item[], name: string): Item | undefined {
  return items.find((i) => sameName(i.name, name)) ?? items.find((i) => sameIngredient(i.name, name));
}

/** Adds an amount to the one already on the list, e.g. two recipes' mince. */
export function combineAmounts(existing: string | null, added: string | null): string | null {
  if (!existing) return added;
  if (!added) return existing;
  return `${existing} + ${added}`;
}

export type Pick = { name: string; amount: string | null };

export type Purchase = {
  /** Existing items to mark as needed, with their new amount. */
  update: { id: string; amount: string | null }[];
  /** New items to add, already needed. */
  create: { name: string; amount: string | null }[];
};

/**
 * What adding the picked ingredients to Groceries changes. Ingredients that
 * are the same item (or the same new name) are merged.
 */
export function planPurchase(items: Item[], picks: Pick[]): Purchase {
  const updates = new Map<string, string | null>();
  const creates: Purchase["create"] = [];
  for (const pick of picks) {
    const name = pick.name.trim();
    if (!name) continue;
    const item = findItem(items, name);
    if (item) {
      const current = updates.has(item.id) ? updates.get(item.id)! : item.status === "need" ? item.amount : null;
      updates.set(item.id, combineAmounts(current, pick.amount));
      continue;
    }
    const created = creates.find((c) => sameIngredient(c.name, name));
    if (created) created.amount = combineAmounts(created.amount, pick.amount);
    else creates.push({ name: name.charAt(0).toUpperCase() + name.slice(1), amount: pick.amount });
  }
  return { update: [...updates].map(([id, amount]) => ({ id, amount })), create: creates };
}
