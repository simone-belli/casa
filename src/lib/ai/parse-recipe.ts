import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { LABELS } from "@/lib/recipes/labels";
import { SCALING_MODES, RECIPE_KINDS } from "@/lib/recipes/types";

const MODEL = "claude-sonnet-5-5";

/** What the model returns; validated again by the review form before saving. */
const parsedRecipeSchema = z.object({
  title: z.string(),
  tags: z.array(z.string()),
  /** Ticked labels (meals, menu categories, diet, season); stored as tags. */
  labels: z.array(z.enum(LABELS)),
  kind: z.enum(RECIPE_KINDS),
  yield: z.string().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string(),
      scaling: z.enum(SCALING_MODES),
      note: z.string().nullable(),
    }),
  ),
  steps: z.array(z.string()),
  /** Things the person should double-check in the review form. */
  warnings: z.array(z.string()),
});
export type ParsedRecipe = z.infer<typeof parsedRecipeSchema>;

/** How to tick the labels; shared with labelRecipes. */
export const LABELS_GUIDE = `Labels: tick every label that applies; any number, including none.
- Meals the dish suits: "breakfast", "lunch", "dinner", "snack".
- "quick": ready to eat in 25 minutes or less from start to finish, including cooking and any waiting.
- "italian", "asian": the dish's cuisine (Asian covers Chinese, Japanese, Korean, Thai, Vietnamese, Indian and so on). Neither if it's another cuisine.
- "slow-cooker": made in a slow cooker, or a long, gentle braise or stew that suits one.
- "bbq": cooked on a barbecue or grill outdoors.
- "starter", "side", "dessert": the course, when the dish is a starter or antipasto, a side dish (contorno), or a dessert. None of them for a main course.
- "vegetarian": no meat or fish (eggs, dairy and honey are fine), including stocks and sauces like fish sauce.
- "hot-season": suits hot weather (served cold or at room temperature, fresh and light, like salads or cold pasta). "cold-season": warming food for cold weather (soups, stews, roasts, baked pasta). Neither if it suits any time of year.`;

const SYSTEM_PROMPT = `You turn recipes into a structured format for Ricettario, a family recipe app used by Simone and Kat while cooking. The input may be dictated or typed text, photos of handwritten or printed notebook pages, or content taken from a web page.

Language: the recipe book is in English, so write everything in natural British English, translating recipes written in another language (often Italian): the title, ingredient names and notes, the yield, steps and tags. Use the names an English cook would shop for ("minced beef", "plain flour", "double cream"); keep an Italian ingredient name only when English uses it too (pecorino, guanciale, mascarpone). Keep a dish's established name when that's what English speakers call it (Spaghetti alla carbonara, Tiramisù, Risotto alla milanese); otherwise translate the title. Write warnings in English.

Transcription: when reading photos, transcribe faithfully. If a word or quantity is illegible, give your best reading and add a warning saying which part to check. Recipes may continue across several photos; combine them into one recipe.

Kind:
- "portion" for dishes served in portions (pasta, mains, soups, salads). Store every scalable quantity per ONE ADULT PORTION: divide the original amounts by the number of servings the recipe states. If the recipe gives no number of servings, estimate it from the quantities and add a warning stating the number you assumed.
- "batch" for things made as a unit (cakes, bread, biscuits, jams, sauces made in bulk). Keep quantities for one batch as written, and set "yield" to a short description such as "1 cake, 24 cm tin" or "about 20 biscuits". "yield" is null for portion recipes.

Units: metric only. Use g, kg, ml, l, tsp, tbsp, or a count unit (piece, clove, slice, sprig, leaf, bunch, can, jar, packet, tin, pinch). Use an empty unit for plain counts ("3 eggs" is quantity 3, unit ""). Convert imperial and US units (cups, ounces, pounds, sticks of butter, fl oz) to metric, using typical weights for dry ingredients (for example 1 cup of flour is about 125 g, 1 cup of sugar about 200 g). Convert oven temperatures in °F to °C inside the steps. Keep the unit singular; the app adds plurals.

Quantities: "quantity" is a number or null. Use null for amounts like "salt to taste", "q.b.", or "a drizzle of oil", and put the wording in "note" if useful. Ranges become their midpoint.

Scaling, for every ingredient:
- "linear": scales with the number of people (most ingredients).
- "rounded": scales but must be a whole number when cooking (eggs, whole vegetables, cans).
- "fixed": does not change with the number of people (a pinch of salt, a bay leaf, a baking tin, oil for greasing).

Tips written on the page go into the step they belong to. Steps: one action per step, in order, without numbering.

${LABELS_GUIDE}

Tags: a few lowercase tags such as the main ingredient or occasion; don't repeat the labels as tags.

If the input does not contain a recipe, return an empty title, no ingredients or steps, and a warning explaining what was found instead.`;

export type ParseInput =
  | { type: "text"; text: string }
  | { type: "photos"; images: { mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }[] }
  | { type: "web"; url: string; content: string; structured: boolean };

function userContent(input: ParseInput): Anthropic.Beta.BetaContentBlockParam[] {
  switch (input.type) {
    case "text":
      return [
        {
          type: "text",
          text: `Here is a recipe someone dictated or typed:\n\n<recipe>\n${input.text}\n</recipe>`,
        },
      ];
    case "photos":
      return [
        ...input.images.map(
          (image): Anthropic.Beta.BetaImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.data },
          }),
        ),
        {
          type: "text",
          text: `These ${input.images.length === 1 ? "is a photo" : `are ${input.images.length} photos, in order,`} of a recipe from a notebook. Transcribe and structure it.`,
        },
      ];
    case "web":
      return [
        {
          type: "text",
          text: `Here is ${input.structured ? "the schema.org Recipe data" : "the text"} of the web page ${input.url}:\n\n<page>\n${input.content}\n</page>`,
        },
      ];
  }
}

export class ParseError extends Error {}

export async function parseRecipe(input: ParseInput): Promise<ParsedRecipe> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(parsedRecipeSchema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent(input) }],
  });

  if (response.stop_reason === "refusal") {
    throw new ParseError("The AI declined to read this recipe. Try typing it in instead.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new ParseError("This recipe is too long to read in one go.");
  }
  if (!response.parsed_output) {
    throw new ParseError("The AI's answer couldn't be read. Please try again.");
  }
  return response.parsed_output;
}
