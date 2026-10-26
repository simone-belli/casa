import { describe, expect, it } from "vitest";
import { formatAmount } from "../format";
import { isSorted, mergeLabels, splitLabels, withSuggestedLabels } from "../labels";
import { currentSeason, filterMenu } from "../menu";
import { parseQuantity, quantityToInput } from "../quantity";
import { portionsFor, scaleQuantity } from "../scaling";
import { searchRecipes } from "../search";
import type { Ingredient, Recipe } from "../types";

const ing = (quantity: number | null, scaling: Ingredient["scaling"], unit = "g"): Ingredient => ({
  name: "x",
  quantity,
  unit,
  scaling,
  note: null,
});

describe("portionsFor", () => {
  it("counts a child as half an adult", () => {
    expect(portionsFor(2, 2)).toBe(3);
    expect(portionsFor(1, 0)).toBe(1);
    expect(portionsFor(0, 1)).toBe(0.5);
  });
});

describe("scaleQuantity", () => {
  it("multiplies linear ingredients", () => {
    expect(scaleQuantity(ing(100, "linear"), 3)).toBe(300);
    expect(scaleQuantity(ing(100, "linear"), 0.5)).toBe(50);
  });

  it("rounds to whole units with a minimum of 1", () => {
    expect(scaleQuantity(ing(0.5, "rounded", ""), 3)).toBe(2); // 1.5 eggs -> 2
    expect(scaleQuantity(ing(0.5, "rounded", ""), 1)).toBe(1); // 0.5 -> 1 (round half up)
    expect(scaleQuantity(ing(0.25, "rounded", ""), 1)).toBe(1); // never 0
    expect(scaleQuantity(ing(1, "rounded", ""), 2.5)).toBe(3);
  });

  it("never scales fixed ingredients", () => {
    expect(scaleQuantity(ing(1, "fixed", "pinch"), 3)).toBe(1);
  });

  it("leaves 'to taste' ingredients without a quantity", () => {
    expect(scaleQuantity(ing(null, "linear"), 3)).toBeNull();
  });
});

describe("formatAmount", () => {
  it("shows whole grams above 10 g", () => {
    expect(formatAmount(333.333, "g")).toBe("333 g");
    expect(formatAmount(12.4, "ml")).toBe("12 ml");
  });

  it("keeps small weights readable", () => {
    expect(formatAmount(7.3, "g")).toBe("7.5 g");
    expect(formatAmount(0.33, "g")).toBe("0.3 g");
    expect(formatAmount(0.01, "g")).toBe("0.1 g");
  });

  it("switches to kg and l from 1000", () => {
    expect(formatAmount(1500, "g")).toBe("1.5 kg");
    expect(formatAmount(1000, "ml")).toBe("1 l");
    expect(formatAmount(1.333, "kg")).toBe("1.33 kg");
  });

  it("uses quarters for spoons", () => {
    expect(formatAmount(1.5, "tbsp")).toBe("1½ tbsp");
    expect(formatAmount(0.3, "tsp")).toBe("¼ tsp");
    expect(formatAmount(0.1, "tsp")).toBe("¼ tsp");
    expect(formatAmount(2.8, "tsp")).toBe("2¾ tsp");
  });

  it("uses halves for counts and pluralises count units", () => {
    expect(formatAmount(3, "")).toBe("3");
    expect(formatAmount(1.4, "")).toBe("1½");
    expect(formatAmount(0.4, "")).toBe("½");
    expect(formatAmount(2, "clove")).toBe("2 cloves");
    expect(formatAmount(1, "clove")).toBe("1 clove");
    expect(formatAmount(1.5, "slice")).toBe("1½ slices");
  });

  it("shows nothing for 'to taste'", () => {
    expect(formatAmount(null, "")).toBe("");
  });
});

describe("searchRecipes", () => {
  const recipe = (title: string, extra: Partial<Recipe> = {}): Recipe => ({
    id: title,
    title,
    notes: null,
    tags: [],
    kind: "portion",
    yield: null,
    ingredients: [],
    steps: [],
    source_url: null,
    source_text: null,
    photo_paths: [],
    created_by: null,
    updated_by: null,
    created_at: "",
    updated_at: "",
    ...extra,
  });
  const recipes = [
    recipe("Ragù alla bolognese", { tags: ["sunday"] }),
    recipe("Torta di mele", { ingredients: [ing(0.5, "rounded", "")].map((i) => ({ ...i, name: "uova" })) }),
    recipe("Pesto", { notes: "Nonna's recipe" }),
  ];

  it("ignores case and accents", () => {
    expect(searchRecipes(recipes, "RAGU").map((r) => r.title)).toEqual(["Ragù alla bolognese"]);
  });

  it("matches ingredients, tags and notes", () => {
    expect(searchRecipes(recipes, "uova").map((r) => r.title)).toEqual(["Torta di mele"]);
    expect(searchRecipes(recipes, "sunday").map((r) => r.title)).toEqual(["Ragù alla bolognese"]);
    expect(searchRecipes(recipes, "nonna").map((r) => r.title)).toEqual(["Pesto"]);
  });

  it("requires every word to match", () => {
    expect(searchRecipes(recipes, "torta pesto")).toEqual([]);
    expect(searchRecipes(recipes, "  ")).toHaveLength(3);
  });
});

describe("parseQuantity", () => {
  it("reads numbers, commas, fractions and glyphs", () => {
    expect(parseQuantity("200")).toBe(200);
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity(".5")).toBe(0.5);
    expect(parseQuantity("1/2")).toBe(0.5);
    expect(parseQuantity("1 1/2")).toBe(1.5);
    expect(parseQuantity("1½")).toBe(1.5);
    expect(parseQuantity("¾")).toBe(0.75);
  });

  it("treats empty as no quantity and rejects nonsense", () => {
    expect(parseQuantity("  ")).toBeNull();
    expect(parseQuantity("abc")).toBeUndefined();
    expect(parseQuantity("1/0")).toBeUndefined();
  });

  it("formats stored numbers for inputs", () => {
    expect(quantityToInput(0.1 + 0.2)).toBe("0.3");
    expect(quantityToInput(null)).toBe("");
  });
});

describe("labels", () => {
  it("splits labels from other tags", () => {
    expect(splitLabels(["snack", "pasta", "quick", "dinner", "lunch"])).toEqual({ labels: ["lunch", "dinner", "snack", "quick"], others: ["pasta"] });
    expect(splitLabels([])).toEqual({ labels: [], others: [] });
  });

  it("merges labels first, in order, without duplicates", () => {
    expect(mergeLabels(["dinner", "breakfast"], ["Pasta", "pasta", "lunch", " "])).toEqual(["breakfast", "dinner", "pasta"]);
    expect(mergeLabels([], ["dolci"])).toEqual(["dolci"]);
    expect(mergeLabels(["cold-season", "vegetarian", "italian", "snack"], ["Quick"])).toEqual(["snack", "italian", "vegetarian", "cold-season"]);
  });
});

describe("suggested labels", () => {
  it("counts a recipe as sorted once it has a menu, diet or season label", () => {
    expect(isSorted(["dinner", "pasta"])).toBe(false);
    expect(isSorted(["dinner", "cold-season"])).toBe(true);
  });

  it("keeps ticked meals and other tags, and replaces the menu labels", () => {
    expect(withSuggestedLabels(["lunch", "quick", "pasta"], ["dinner", "italian", "vegetarian"])).toEqual(["lunch", "italian", "vegetarian", "pasta"]);
    expect(withSuggestedLabels(["pasta"], ["dinner", "italian"])).toEqual(["dinner", "italian", "pasta"]);
  });
});

describe("menu", () => {
  const recipe = (title: string, tags: string[]): Recipe => ({
    id: title,
    title,
    notes: null,
    tags,
    kind: "portion",
    yield: null,
    ingredients: [],
    steps: [],
    source_url: null,
    source_text: null,
    photo_paths: [],
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  });
  const salad = recipe("Panzanella", ["quick", "italian", "vegetarian", "hot-season"]);
  const stew = recipe("Spezzatino", ["slow-cooker", "italian", "cold-season"]);
  const curry = recipe("Dal", ["quick", "asian", "vegetarian"]);
  const both = recipe("Minestrone", ["italian", "vegetarian", "hot-season", "cold-season"]);
  const all = [salad, stew, curry, both];
  const titles = (list: Recipe[]) => list.map((r) => r.title);

  it("finds the season from the hot months", () => {
    expect(currentSeason([6, 7, 8], new Date(2026, 6, 15))).toBe("hot-season");
    expect(currentSeason([6, 7, 8], new Date(2026, 0, 15))).toBe("cold-season");
  });

  it("filters by course and vegetarian", () => {
    expect(titles(filterMenu(all, { course: null, vegetarian: false, season: null }))).toEqual(titles(all));
    expect(titles(filterMenu(all, { course: "quick", vegetarian: false, season: null }))).toEqual(["Panzanella", "Dal"]);
    expect(titles(filterMenu(all, { course: "italian", vegetarian: true, season: null }))).toEqual(["Panzanella", "Minestrone"]);
  });

  it("keeps the season's recipes and those good all year", () => {
    expect(titles(filterMenu(all, { course: null, vegetarian: false, season: "hot-season" }))).toEqual(["Panzanella", "Dal", "Minestrone"]);
    expect(titles(filterMenu(all, { course: "italian", vegetarian: false, season: "cold-season" }))).toEqual(["Spezzatino", "Minestrone"]);
  });
});
