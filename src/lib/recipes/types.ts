import { z } from "zod";

export const SCALING_MODES = ["linear", "rounded", "fixed"] as const;
export type ScalingMode = (typeof SCALING_MODES)[number];

export const RECIPE_KINDS = ["portion", "batch"] as const;
export type RecipeKind = (typeof RECIPE_KINDS)[number];

/** Suggested units; any other short unit is accepted too. */
export const UNIT_SUGGESTIONS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "pinch",
  "piece",
  "clove",
  "slice",
  "sprig",
  "leaf",
  "bunch",
  "can",
  "jar",
  "packet",
  "tin",
] as const;

export const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  /** Null for amounts like "salt to taste". */
  quantity: z.number().nonnegative().nullable(),
  /** Empty for plain counts ("3 eggs"). */
  unit: z.string().trim(),
  scaling: z.enum(SCALING_MODES),
  note: z.string().trim().nullable(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

/** The editable content of a recipe (what the review/edit form works on). */
export const recipeDraftSchema = z.object({
  title: z.string().trim().min(1),
  notes: z.string().trim().nullable(),
  tags: z.array(z.string().trim().min(1)),
  kind: z.enum(RECIPE_KINDS),
  yield: z.string().trim().nullable(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string().trim().min(1)),
  source_url: z.string().nullable(),
  source_text: z.string().nullable(),
  photo_paths: z.array(z.string()),
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

export type Recipe = RecipeDraft & {
  id: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function emptyDraft(): RecipeDraft {
  return {
    title: "",
    notes: null,
    tags: [],
    kind: "portion",
    yield: null,
    ingredients: [],
    steps: [],
    source_url: null,
    source_text: null,
    photo_paths: [],
  };
}
