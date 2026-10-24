const SPOON_UNITS = new Set(["tsp", "tbsp"]);
const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** Units that read as counts and take a plural ("2 cloves"). */
const PLURALS: Record<string, string> = {
  piece: "pieces",
  clove: "cloves",
  slice: "slices",
  sprig: "sprigs",
  leaf: "leaves",
  bunch: "bunches",
  can: "cans",
  jar: "jars",
  packet: "packets",
  tin: "tins",
  pinch: "pinches",
};

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** 1.5 -> "1½", 0.25 -> "¼", 2 -> "2"; falls back to decimals. */
function withFraction(value: number): string {
  const whole = Math.floor(value);
  const frac = Math.round((value - whole) * 100) / 100;
  if (frac === 0) return String(whole);
  const glyph = FRACTIONS[frac];
  if (glyph) return whole === 0 ? glyph : `${whole}${glyph}`;
  return trimDecimals(value, 2);
}

function trimDecimals(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

/**
 * Formats a (possibly scaled) quantity and unit for display, rounding sensibly:
 * whole grams/millilitres above 10, quarters for spoons, halves for counts,
 * and switching to kg / l from 1000 g / 1000 ml.
 */
export function formatAmount(quantity: number | null, unit: string): string {
  if (quantity === null) return "";
  let q = quantity;
  let u = unit.trim();

  if (u === "g" && q >= 1000) {
    q /= 1000;
    u = "kg";
  } else if (u === "ml" && q >= 1000) {
    q /= 1000;
    u = "l";
  }

  let text: string;
  let shown = q;
  if (q === 0) {
    text = "0";
  } else if (u === "g" || u === "ml") {
    if (q > 10) text = String(Math.round(q));
    else if (q >= 1) text = trimDecimals(roundTo(q, 0.5), 1);
    else text = trimDecimals(Math.max(roundTo(q, 0.1), 0.1), 1);
  } else if (u === "kg" || u === "l") {
    text = trimDecimals(q, 2);
  } else {
    // Spoons in quarters; counts and other units in halves (quarters below 1).
    const step = SPOON_UNITS.has(u) || q < 1 ? 0.25 : 0.5;
    shown = Math.max(roundTo(q, step), step);
    text = withFraction(shown);
  }

  if (!u) return text;
  const plural = PLURALS[u];
  if (plural && shown > 1) u = plural;
  return `${text} ${u}`;
}
