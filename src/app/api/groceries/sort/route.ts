import { NextResponse } from "next/server";
import { z } from "zod";
import { describeClaudeError } from "@/lib/ai/errors";
import { SortError, sortGroceries } from "@/lib/ai/sort-groceries";
import { pastedChunks } from "@/lib/groceries/views";
import { mapLimited } from "@/lib/map-limited";
import { currentMember } from "@/lib/supabase/server";

const requestSchema = z.object({
  /** The pasted list as is; blank lines mark where sections end. */
  text: z.string().trim().min(1).max(50_000),
});

/** Most lines sorted in one go; longer lists are sorted in parts, a few at a time. */
const LINES_PER_PART = 80;
const PARTS_AT_ONCE = 2;
const MAX_LINES = 1000;

export type SortResponse = { items: { name: string; places: string[] }[] } | { error: string };

export async function POST(request: Request): Promise<NextResponse<SortResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Nothing to sort." }, { status: 400 });

  const parts = pastedChunks(body.data.text, LINES_PER_PART).map((lines) => lines.map((l) => l.slice(0, 200)));
  const lineCount = parts.reduce((n, p) => n + p.length, 0);
  if (lineCount === 0) return NextResponse.json({ error: "Nothing to sort." }, { status: 400 });
  if (lineCount > MAX_LINES) {
    return NextResponse.json({ error: `That's ${lineCount} lines; paste at most ${MAX_LINES} at a time.` }, { status: 400 });
  }

  try {
    const sorted = await mapLimited(parts, PARTS_AT_ONCE, (lines) => sortGroceries(lines));
    const seen = new Set<string>();
    const items = sorted
      .flatMap((s) => s.items)
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
    return NextResponse.json({ error: describeClaudeError(error) }, { status: 502 });
  }
}
