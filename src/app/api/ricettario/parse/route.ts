import { NextResponse } from "next/server";
import { z } from "zod";
import { FetchPageError, fetchRecipePage } from "@/lib/ai/fetch-page";
import { ParseError, parseRecipe, type ParseInput, type ParsedRecipe } from "@/lib/ai/parse-recipe";
import { mergeMealTags } from "@/lib/recipes/meals";
import { MAX_PHOTOS, PHOTO_BUCKET } from "@/lib/recipes/photos";
import type { RecipeDraft } from "@/lib/recipes/types";
import { currentMember } from "@/lib/supabase/server";

const requestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(50_000) }),
  z.object({ type: z.literal("photos"), paths: z.array(z.string().min(1)).min(1).max(MAX_PHOTOS) }),
  z.object({ type: z.literal("url"), url: z.string().trim().min(1).max(2_000) }),
]);
type ParseRequest = z.infer<typeof requestSchema>;

export type ParseResponse = { draft: RecipeDraft; warnings: string[] } | { error: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function toDraft(parsed: ParsedRecipe, request: ParseRequest, sourceUrl: string | null): RecipeDraft {
  return {
    title: parsed.title.trim(),
    // Notes are left for the person to write.
    notes: null,
    tags: mergeMealTags([...parsed.meals, ...parsed.tags], parsed.tags),
    kind: parsed.kind,
    yield: parsed.kind === "batch" ? parsed.yield?.trim() || null : null,
    ingredients: parsed.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity !== null && i.quantity >= 0 ? i.quantity : null,
        unit: i.unit.trim(),
        scaling: i.scaling,
        note: i.note?.trim() || null,
      })),
    steps: parsed.steps.map((s) => s.trim()).filter(Boolean),
    source_url: sourceUrl,
    source_text: request.type === "text" ? request.text : null,
    photo_paths: request.type === "photos" ? request.paths : [],
  };
}

export async function POST(request: Request): Promise<NextResponse<ParseResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  const req = body.data;

  try {
    let input: ParseInput;
    let sourceUrl: string | null = null;

    if (req.type === "text") {
      input = { type: "text", text: req.text };
    } else if (req.type === "url") {
      const page = await fetchRecipePage(req.url);
      sourceUrl = page.url;
      input = { type: "web", url: page.url, content: page.content, structured: page.structured };
    } else {
      const images = await Promise.all(
        req.paths.map(async (path) => {
          const { data, error } = await member.supabase.storage.from(PHOTO_BUCKET).download(path);
          if (error || !data) throw new ParseError("A photo couldn't be loaded. Please try again.");
          const mediaType = (IMAGE_TYPES as readonly string[]).includes(data.type)
            ? (data.type as ImageType)
            : "image/jpeg";
          return { mediaType, data: Buffer.from(await data.arrayBuffer()).toString("base64") };
        }),
      );
      input = { type: "photos", images };
    }

    const parsed = await parseRecipe(input);
    return NextResponse.json({ draft: toDraft(parsed, req, sourceUrl), warnings: parsed.warnings });
  } catch (error) {
    if (error instanceof ParseError || error instanceof FetchPageError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Recipe parsing failed", error);
    return NextResponse.json(
      { error: "Something went wrong while reading the recipe. Please try again." },
      { status: 502 },
    );
  }
}
