/**
 * Tags people tick in the recipe form rather than type. They're stored with
 * the other tags (so search finds them) and the menu filters by them.
 */
export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
/** The menu's categories. */
export const COURSES = ["quick", "italian", "asian", "slow-cooker", "bbq", "starter", "side", "dessert"] as const;
export const DIETS = ["vegetarian"] as const;
/** A recipe with neither season ticked is good all year. */
export const SEASONS = ["hot-season", "cold-season"] as const;

export const LABELS = [...MEALS, ...COURSES, ...DIETS, ...SEASONS] as const;
export type Meal = (typeof MEALS)[number];
export type Course = (typeof COURSES)[number];
export type Season = (typeof SEASONS)[number];
export type Label = (typeof LABELS)[number];

export const LABEL_NAMES: Record<Label, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  quick: "Quick",
  italian: "Italian",
  asian: "Asian",
  "slow-cooker": "Slow cook",
  bbq: "BBQ",
  starter: "Starter",
  side: "Side dish",
  dessert: "Dessert",
  vegetarian: "Vegetarian",
  "hot-season": "Hot season",
  "cold-season": "Cold season",
};

export const isLabel = (tag: string): tag is Label => (LABELS as readonly string[]).includes(tag);

/** How a tag is shown: labels by their name, other tags as typed. */
export const tagName = (tag: string) => (isLabel(tag) ? LABEL_NAMES[tag] : tag);

/** Splits a recipe's tags into its ticked labels and its other tags. */
export function splitLabels(tags: string[]): { labels: Label[]; others: string[] } {
  return {
    labels: LABELS.filter((label) => tags.includes(label)),
    others: tags.filter((tag) => !isLabel(tag)),
  };
}

/** Labels first (in LABELS order), then the other tags, without duplicates. */
export function mergeLabels(labels: readonly string[], others: string[]): string[] {
  const ticked = LABELS.filter((label) => labels.includes(label));
  const rest = others.map((t) => t.trim().toLowerCase()).filter((t) => t && !isLabel(t));
  return [...ticked, ...new Set(rest)];
}

/** Labels the menu filters by (everything but the meals). */
export const MENU_LABELS = [...COURSES, ...DIETS, ...SEASONS] as const;

const isMeal = (label: Label) => (MEALS as readonly string[]).includes(label);

/**
 * Whether a recipe has been sorted into the menu. A main course that's good
 * all year and has meat has none of these labels, so it counts as unsorted
 * until someone ticks something for it.
 */
export const isSorted = (tags: string[]) => MENU_LABELS.some((label) => tags.includes(label));

/**
 * A recipe's tags with Claude's suggested menu labels in place of its own.
 * Meals already ticked are kept; Claude's are used only when none are.
 */
export function withSuggestedLabels(tags: string[], suggested: Label[]): string[] {
  const { labels, others } = splitLabels(tags);
  const meals = labels.filter(isMeal);
  const next = [...(meals.length > 0 ? meals : suggested.filter(isMeal)), ...suggested.filter((l) => !isMeal(l))];
  return mergeLabels(next, others);
}
