import { NextResponse } from "next/server";
import { z } from "zod";
import { describeClaudeError } from "@/lib/ai/errors";
import { LabelError, labelRecipes } from "@/lib/ai/label-recipes";
import type { Label } from "@/lib/recipes/labels";
import { RECIPES_PER_REQUEST } from "@/lib/recipes/menu";
import type { Recipe } from "@/lib/recipes/types";
import { currentMember } from "@/lib/supabase/server";

export const maxDuration = 60;

const requestSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(RECIPES_PER_REQUEST) });

export type LabelResponse = { suggestions: { id: string; labels: Label[] }[] } | { error: string };

/** Suggests menu labels for the given recipes. Nothing is saved; the phone shows them for review. */
export async function POST(request: Request): Promise<NextResponse<LabelResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Which recipes?" }, { status: 400 });

  const { data, error } = await member.supabase.from("recipes").select("*").in("id", body.data.ids);
  if (error) return NextResponse.json({ error: "Couldn't load the recipes. Please try again." }, { status: 502 });
  if (data.length === 0) return NextResponse.json({ suggestions: [] });

  try {
    return NextResponse.json({ suggestions: await labelRecipes(data as Recipe[]) });
  } catch (error) {
    if (error instanceof LabelError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Recipe labelling failed", error);
    return NextResponse.json({ error: describeClaudeError(error) }, { status: 502 });
  }
}
