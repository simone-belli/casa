/** Meals a recipe can be ticked for; stored as tags so search finds them. */
export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

const isMeal = (tag: string): tag is Meal => (MEALS as readonly string[]).includes(tag);

/** Splits a recipe's tags into its ticked meals and its other tags. */
export function splitMealTags(tags: string[]): { meals: Meal[]; others: string[] } {
  return {
    meals: MEALS.filter((meal) => tags.includes(meal)),
    others: tags.filter((tag) => !isMeal(tag)),
  };
}

/** Meal tags first (in breakfast, lunch, dinner order), then the others, without duplicates. */
export function mergeMealTags(meals: readonly string[], others: string[]): string[] {
  const ticked = MEALS.filter((meal) => meals.includes(meal));
  const rest = others.map((t) => t.trim().toLowerCase()).filter((t) => t && !isMeal(t));
  return [...ticked, ...new Set(rest)];
}
