import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MODEL = "claude-sonnet-5-5";

const sortedSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      /** Home place names: existing ones, or a new one when nothing fits. */
      places: z.array(z.string()),
    }),
  ),
});
export type SortedGroceries = z.infer<typeof sortedSchema>;

const SYSTEM_PROMPT = `You help Simone and Kat move their household shopping list into Groceries, a shared list app. They paste their old checklist (usually from Apple Notes), one entry per line, and you sort each item into the home places where it is kept.

For each line that is something you buy, return one item:
- "name": the item as written, tidied up: fix obvious typos, start with a capital letter, drop checkbox symbols and quantities in brackets. Keep the language it was written in (often Italian or English); do not translate.
- "places": the home places where it is kept, chosen from the existing places you are given, using their exact names. Usually one; give two or more only when it really lives in several (for example sponges in both "Cleaning" and "Bathroom"). Use an empty list if you really can't tell.

Lines that are headings rather than items (for example "Fridge", "FRIGO", "Cleaning stuff:") are not items: leave them out, but use them as a strong hint for the place of the lines that follow.

If several items clearly belong to a place that doesn't exist yet (for example "Baby" or "Pets"), you may use a new short place name for them, used consistently. Prefer the existing places.

Merge exact duplicates. Keep the original order otherwise.`;

export class SortError extends Error {}

/** Sorts one part of a pasted list (keep parts to a few dozen lines). */
export async function sortGroceries(lines: string[], places: string[]): Promise<SortedGroceries> {
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
          content: `Existing home places: ${places.length > 0 ? places.map((p) => `"${p}"`).join(", ") : "(none yet)"}\n\nThe pasted list:\n<list>\n${lines.join("\n")}\n</list>`,
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
