import { COURSES, type Course, type Season } from "./labels";
import type { Recipe } from "./types";

/**
 * A menu button: a category, the starred recipes, or "other" (recipes in
 * none of the categories).
 */
export type MenuSection = Course | "favourites" | "other";

export const MENU_SECTIONS: readonly MenuSection[] = ["favourites", ...COURSES, "other"];

export const isMenuSection = (value: string | null): value is MenuSection =>
  (MENU_SECTIONS as readonly (string | null)[]).includes(value);

/** The menu's buttons, in order. */
export const MENU: { tag: MenuSection; name: string; icon: string }[] = [
  { tag: "favourites", name: "Favourites", icon: "⭐" },
  { tag: "quick", name: "Quick", icon: "⏱️" },
  { tag: "italian", name: "Italian", icon: "🍝" },
  { tag: "asian", name: "Asian", icon: "🥢" },
  { tag: "slow-cooker", name: "Slow cook", icon: "🍲" },
  { tag: "bbq", name: "BBQ", icon: "🔥" },
  { tag: "starter", name: "Starters", icon: "🥟" },
  { tag: "side", name: "Side dishes", icon: "🥗" },
  { tag: "dessert", name: "Desserts", icon: "🍰" },
  { tag: "other", name: "Other", icon: "🍽️" },
];

/** Recipes per request when asking Claude to sort recipes into the menu. */
export const RECIPES_PER_REQUEST = 8;

/** Months (1–12) of the hot season when the household hasn't chosen. */
export const DEFAULT_HOT_MONTHS = [5, 6, 7, 8, 9];

export function currentSeason(hotMonths: readonly number[], date = new Date()): Season {
  return hotMonths.includes(date.getMonth() + 1) ? "hot-season" : "cold-season";
}

export type MenuFilter = { course: MenuSection | null; vegetarian: boolean; season: Season | null };

function inSection(recipe: Recipe, section: MenuSection | null): boolean {
  if (!section) return true;
  if (section === "favourites") return Boolean(recipe.favourite);
  if (section === "other") return !COURSES.some((course) => recipe.tags.includes(course));
  return recipe.tags.includes(section);
}

/**
 * Recipes matching the menu's choices. The season keeps recipes ticked for
 * that season and those good all year (neither season ticked).
 */
export function filterMenu<T extends Recipe>(recipes: T[], { course, vegetarian, season }: MenuFilter): T[] {
  const otherSeason: Season | null = season === "hot-season" ? "cold-season" : season === "cold-season" ? "hot-season" : null;
  return recipes.filter(
    (recipe) =>
      inSection(recipe, course) &&
      (!vegetarian || recipe.tags.includes("vegetarian")) &&
      (!otherSeason || !recipe.tags.includes(otherSeason) || recipe.tags.includes(season!)),
  );
}
