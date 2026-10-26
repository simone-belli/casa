import type { Course, Season } from "./labels";
import type { Recipe } from "./types";

/** The menu's buttons, in order. */
export const MENU: { tag: Course; name: string; icon: string }[] = [
  { tag: "quick", name: "Quick", icon: "⏱️" },
  { tag: "italian", name: "Italian", icon: "🍝" },
  { tag: "asian", name: "Asian", icon: "🥢" },
  { tag: "slow-cooker", name: "Slow cook", icon: "🍲" },
  { tag: "bbq", name: "BBQ", icon: "🔥" },
  { tag: "starter", name: "Starters", icon: "🥟" },
  { tag: "side", name: "Side dishes", icon: "🥗" },
  { tag: "dessert", name: "Desserts", icon: "🍰" },
];

/** Recipes per request when asking Claude to sort recipes into the menu. */
export const RECIPES_PER_REQUEST = 8;

/** Months (1–12) of the hot season when the household hasn't chosen. */
export const DEFAULT_HOT_MONTHS = [5, 6, 7, 8, 9];

export function currentSeason(hotMonths: readonly number[], date = new Date()): Season {
  return hotMonths.includes(date.getMonth() + 1) ? "hot-season" : "cold-season";
}

export type MenuFilter = { course: Course | null; vegetarian: boolean; season: Season | null };

/**
 * Recipes matching the menu's choices. The season keeps recipes ticked for
 * that season and those good all year (neither season ticked).
 */
export function filterMenu<T extends Recipe>(recipes: T[], { course, vegetarian, season }: MenuFilter): T[] {
  const otherSeason: Season | null = season === "hot-season" ? "cold-season" : season === "cold-season" ? "hot-season" : null;
  return recipes.filter(
    ({ tags }) =>
      (!course || tags.includes(course)) &&
      (!vegetarian || tags.includes("vegetarian")) &&
      (!otherSeason || !tags.includes(otherSeason) || tags.includes(season!)),
  );
}
