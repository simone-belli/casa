/** Fields of a schema.org Recipe worth passing on to the parser. */
const RECIPE_FIELDS = [
  "name",
  "description",
  "recipeYield",
  "recipeIngredient",
  "ingredients",
  "recipeInstructions",
  "recipeCategory",
  "recipeCuisine",
  "keywords",
  "prepTime",
  "cookTime",
  "totalTime",
  "inLanguage",
];

/** Upper bound on page text sent to the parser, to keep a single parse cheap. */
const MAX_TEXT_CHARS = 150_000;

function isRecipe(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (isRecipe(node)) return node;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
  } else if (node && typeof node === "object") {
    const graph = (node as Record<string, unknown>)["@graph"];
    if (graph) return findRecipe(graph);
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

/**
 * Pulls the recipe out of a web page: its schema.org Recipe data when the page
 * has it, otherwise the page's readable text.
 */
export function extractPageContent(html: string): { content: string; structured: boolean } {
  const scripts = html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of scripts) {
    try {
      const recipe = findRecipe(JSON.parse(json));
      if (recipe) {
        const picked = Object.fromEntries(RECIPE_FIELDS.filter((k) => k in recipe).map((k) => [k, recipe[k]]));
        if (picked.recipeIngredient || picked.ingredients || picked.recipeInstructions) {
          return { content: JSON.stringify(picked, null, 1), structured: true };
        }
      }
    } catch {
      // Malformed JSON-LD is common; fall through to the next block or page text.
    }
  }
  return { content: htmlToText(html).slice(0, MAX_TEXT_CHARS), structured: false };
}
