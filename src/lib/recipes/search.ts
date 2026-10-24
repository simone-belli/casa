import type { Recipe } from "./types";

/** Lower-cases and strips accents, so "ragu" finds "Ragù". */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function haystack(recipe: Recipe): string {
  return normalise(
    [
      recipe.title,
      recipe.notes ?? "",
      recipe.tags.join(" "),
      recipe.ingredients.map((i) => i.name).join(" "),
    ].join("\n"),
  );
}

/** Recipes whose title, ingredients, tags or notes contain every search word. */
export function searchRecipes<T extends Recipe>(recipes: T[], query: string): T[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return recipes;
  return recipes.filter((recipe) => {
    const text = haystack(recipe);
    return words.every((word) => text.includes(word));
  });
}
