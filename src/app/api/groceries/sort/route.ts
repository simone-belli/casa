import { NextResponse } from "next/server";
import { z } from "zod";
import { SortError, sortGroceries } from "@/lib/ai/sort-groceries";
import { currentMember } from "@/lib/supabase/server";

const requestSchema = z.object({
  lines: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  places: z.array(z.string().trim().min(1).max(100)).max(100),
});

export type SortResponse = { items: { name: string; places: string[] }[] } | { error: string };

export async function POST(request: Request): Promise<NextResponse<SortResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Nothing to sort." }, { status: 400 });

  try {
    const sorted = await sortGroceries(body.data.lines, body.data.places);
    const seen = new Set<string>();
    const items = sorted.items
      .map((i) => ({ name: i.name.trim(), places: [...new Set(i.places.map((p) => p.trim()).filter(Boolean))] }))
      .filter((i) => {
        const key = i.name.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof SortError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Sorting groceries failed", error);
    return NextResponse.json({ error: "Something went wrong while sorting the list. Please try again." }, { status: 502 });
  }
}
