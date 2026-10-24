const GLYPHS: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

/**
 * Reads a quantity typed in the edit form: "200", "1,5", "1/2", "1 1/2",
 * "1½". Empty means no quantity ("to taste"). Returns undefined if unreadable.
 */
export function parseQuantity(input: string): number | null | undefined {
  let text = input.trim().replace(",", ".");
  if (text === "") return null;

  let total = 0;
  const glyph = [...text].find((c) => c in GLYPHS);
  if (glyph) {
    total += GLYPHS[glyph];
    text = text.replace(glyph, "").trim();
    if (text === "") return total;
  }

  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return total + Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction && Number(fraction[2]) > 0) return total + Number(fraction[1]) / Number(fraction[2]);
  if (/^\d*\.?\d+$/.test(text) || /^\d+\.$/.test(text)) return total + Number(text);
  return undefined;
}

/** Shows a stored number in an input without float noise (0.30000000000000004). */
export function quantityToInput(quantity: number | null): string {
  if (quantity === null) return "";
  return String(Number(quantity.toFixed(3)));
}
