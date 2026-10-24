import type { Ingredient } from "./types";

export const BATCH_MULTIPLIERS = [0.5, 1, 1.5, 2, 3] as const;

/** A child counts as half an adult. */
export function portionsFor(adults: number, children: number): number {
  return adults + 0.5 * children;
}

/**
 * The quantity to show for an ingredient, given the recipe's stored quantity
 * (per adult portion or per batch) and the factor to scale by (number of
 * portions, or the batch multiplier).
 */
export function scaleQuantity(ingredient: Ingredient, factor: number): number | null {
  const { quantity, scaling } = ingredient;
  if (quantity === null) return null;
  switch (scaling) {
    case "fixed":
      return quantity;
    case "rounded":
      return Math.max(1, Math.round(quantity * factor));
    case "linear":
      return quantity * factor;
  }
}
