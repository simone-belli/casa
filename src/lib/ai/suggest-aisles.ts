import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { SortError } from "./sort-groceries";

const MODEL = "claude-sonnet-5-5";

const SYSTEM_PROMPT = `You help Simone and Kat, a family in Australia, shop faster with Groceries, their shared shopping list app. For one supermarket they've listed its aisles (sections) in the order they walk through the shop. For each item you're given, pick the aisle where it is most likely found in that supermarket.

- Use what you know about the supermarket chain named (for example Coles, Woolworths, Aldi, IGA, Harris Farm) and how Australian supermarkets are usually laid out, but always choose one of the aisle names given, exactly as written.
- Item names may be in English or Italian (e.g. "Pomodorini", "Pistacchi", "Acciughe").
- Pick the single likeliest aisle even when unsure; they will correct it later.
- Return every item you were given, with its name exactly as given.`;

export type AisleSuggestion = { name: string; aisle: string };

/** Suggests an aisle of the supermarket for each item (keep to a few dozen items per call). */
export async function suggestAisles(store: string, aisles: string[], items: string[]): Promise<AisleSuggestion[]> {
  const schema = z.object({
    items: z.array(z.object({ name: z.string(), aisle: z.enum(aisles as [string, ...string[]]) })),
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
      messages: [
        {
          role: "user",
          content: `Supermarket: ${store}\n\nIts aisles, in walking order:\n${aisles.map((a) => `- ${a}`).join("\n")}\n\nItems:\n${items.map((i) => `- ${i}`).join("\n")}`,
        },
      ],
    })
    .catch((error: unknown) => {
      // A reply cut off at max_tokens can't be parsed; see sortGroceries.
      if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
        throw new SortError("Claude's answer was cut off. Please try again.");
      }
      throw error;
    });

  if (response.stop_reason === "refusal") throw new SortError("The AI declined to suggest aisles.");
  if (!response.parsed_output) throw new SortError("The AI's answer couldn't be read. Please try again.");
  return response.parsed_output.items;
}
