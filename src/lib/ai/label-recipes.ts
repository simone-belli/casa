import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { LABELS, type Label } from "@/lib/recipes/labels";
import type { Recipe } from "@/lib/recipes/types";
import { LABELS_GUIDE } from "./parse-recipe";

const MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You sort the recipes of Ricettario, Simone and Kat's family recipe app, into its menu. Recipes may be in Italian or English. For each numbered recipe, tick the labels that apply, judging from its title, ingredients and steps.

${LABELS_GUIDE}

Return every recipe you were given, by its number.`;

export class LabelError extends Error {}

/** Characters of steps sent per recipe, so a long one doesn't crowd the others. */
const MAX_STEPS_CHARS = 1500;

function describe(recipe: Recipe, number: number): string {
  const steps = recipe.steps.join(" ").slice(0, MAX_STEPS_CHARS);
  return [
    `<recipe number="${number}">`,
    `Title: ${recipe.title}`,
    recipe.kind === "batch" && recipe.yield ? `Makes: ${recipe.yield}` : null,
    `Ingredients: ${recipe.ingredients.map((i) => i.name).join(", ")}`,
    steps ? `Steps: ${steps}` : null,
    recipe.notes ? `Notes: ${recipe.notes.slice(0, 500)}` : null,
    "</recipe>",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Suggests labels for each recipe (keep to a handful of recipes per call). */
export async function labelRecipes(recipes: Recipe[]): Promise<{ id: string; labels: Label[] }[]> {
  const schema = z.object({
    recipes: z.array(z.object({ number: z.number().int(), labels: z.array(z.enum(LABELS)) })),
  });
  const client = new Anthropic();
  const response = await client.beta.messages
    .parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: recipes.map((r, i) => describe(r, i + 1)).join("\n\n") }],
    })
    .catch((error: unknown) => {
      // A reply cut off at max_tokens can't be parsed; see sortGroceries.
      if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
        throw new LabelError("Claude's answer was cut off. Please try again.");
      }
      throw error;
    });

  if (response.stop_reason === "refusal") throw new LabelError("The AI declined to sort these recipes.");
  if (!response.parsed_output) throw new LabelError("The AI's answer couldn't be read. Please try again.");
  return response.parsed_output.recipes
    .filter((r) => r.number >= 1 && r.number <= recipes.length)
    .map((r) => ({ id: recipes[r.number - 1].id, labels: r.labels }));
}
