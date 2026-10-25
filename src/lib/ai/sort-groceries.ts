import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { HOME_PLACES } from "@/lib/groceries/types";

const MODEL = "claude-sonnet-5-5";

const sortedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      places: z.array(z.enum(HOME_PLACES)),
    }),
  ),
});
export type SortedGroceries = z.infer<typeof sortedSchema>;

const SYSTEM_PROMPT = `You help Simone and Kat move their household shopping list into Groceries, a shared list app. They paste their old checklist (usually from Apple Notes), one entry per line, and you sort each item into the home places where it is kept.

For each line that is something you buy, return one item:
- "name": the item as written, tidied up: fix obvious typos, start with a capital letter, drop checkbox symbols and quantities in brackets. Keep the language it was written in (often Italian or English); do not translate.
- "places": where it is kept at home. There are exactly seven places:
  - "Fruit": fresh fruit and vegetables
  - "Fridge": anything kept in the fridge (dairy, meat, fresh fish, deli)
  - "Freezer": frozen food and ice
  - "Pantry": dry and packaged food, tins, drinks, spices, baking
  - "Bathroom": toiletries, personal care and medicines
  - "Clean & wash": cleaning products, laundry and household supplies such as foil, bin bags and paper towel
  - "Other": anything that fits none of the above
  Usually one place; give two only when it really lives in both (for example hand soap in "Bathroom" and "Clean & wash").

Lines that are headings rather than items (for example "Fridge", "FRIGO", "Cleaning stuff:") are not items: leave them out, but use them as a strong hint for the place of the lines that follow.

Merge exact duplicates. Keep the original order otherwise.`;

export class SortError extends Error {}

/** Sorts one part of a pasted list (keep parts to a few dozen lines). */
export async function sortGroceries(lines: string[]): Promise<SortedGroceries> {
  const client = new Anthropic();
  const response = await client.beta.messages
    .parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(sortedSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `The pasted list:\n<list>\n${lines.join("\n")}\n</list>`,
        },
      ],
    })
    .catch((error: unknown) => {
      // The SDK parses the answer before we can look at stop_reason, so a
      // reply cut off at max_tokens surfaces here as an unparseable answer.
      if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
        throw new SortError("This part of the list was too long to sort in one go. Try pasting a shorter list.");
      }
      throw error;
    });

  if (response.stop_reason === "refusal") throw new SortError("The AI declined to sort this list.");
  if (response.stop_reason === "max_tokens") throw new SortError("This list is too long to sort in one go. Try pasting half of it.");
  if (!response.parsed_output) throw new SortError("The AI's answer couldn't be read. Please try again.");
  return response.parsed_output;
}
