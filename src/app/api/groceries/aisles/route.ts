import { NextResponse } from "next/server";
import { z } from "zod";
import { describeClaudeError } from "@/lib/ai/errors";
import { SortError } from "@/lib/ai/sort-groceries";
import { suggestAisles } from "@/lib/ai/suggest-aisles";
import { sameName } from "@/lib/groceries/views";
import { mapLimited } from "@/lib/map-limited";
import { currentMember } from "@/lib/supabase/server";

const requestSchema = z.object({ storeId: z.string().uuid() });

/** Items per call to Claude, and calls running at once. */
const ITEMS_PER_PART = 60;
const PARTS_AT_ONCE = 2;

export type AislesResponse = { filed: number; left: number } | { error: string };

/**
 * Files every regular item that isn't sorted yet for this supermarket under
 * the aisle Claude thinks likeliest. Items already filed are left alone.
 */
export async function POST(request: Request): Promise<NextResponse<AislesResponse>> {
  const member = await currentMember();
  if (!member) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Which supermarket?" }, { status: 400 });
  const { storeId } = body.data;
  const db = member.supabase;

  const [store, aisles, items, filed] = await Promise.all([
    db.from("grocery_stores").select("name").eq("id", storeId).maybeSingle(),
    db.from("grocery_aisles").select("id, name, position").eq("store_id", storeId).order("position"),
    db.from("grocery_items").select("id, name").eq("is_one_off", false),
    db.from("grocery_item_aisles").select("item_id").eq("store_id", storeId),
  ]);
  if (store.error || aisles.error || items.error || filed.error) {
    return NextResponse.json({ error: "Couldn't load the list. Please try again." }, { status: 502 });
  }
  if (!store.data) return NextResponse.json({ error: "That supermarket no longer exists." }, { status: 404 });
  if (aisles.data.length === 0) {
    return NextResponse.json({ error: `Add ${store.data.name}'s aisles first.` }, { status: 400 });
  }

  const done = new Set(filed.data.map((f) => f.item_id));
  const unsorted = items.data.filter((i) => !done.has(i.id));
  if (unsorted.length === 0) return NextResponse.json({ filed: 0, left: 0 });

  const aisleNames = [...new Set(aisles.data.map((a) => a.name))];
  const parts: (typeof unsorted)[] = [];
  for (let i = 0; i < unsorted.length; i += ITEMS_PER_PART) parts.push(unsorted.slice(i, i + ITEMS_PER_PART));

  try {
    const suggestions = (
      await mapLimited(parts, PARTS_AT_ONCE, (part) => suggestAisles(store.data!.name, aisleNames, part.map((i) => i.name)))
    ).flat();

    const rows = unsorted.flatMap((item) => {
      const suggestion = suggestions.find((s) => s.name === item.name) ?? suggestions.find((s) => sameName(s.name, item.name));
      const aisle = suggestion && aisles.data.find((a) => a.name === suggestion.aisle);
      return aisle ? [{ item_id: item.id, store_id: storeId, aisle_id: aisle.id }] : [];
    });
    if (rows.length > 0) {
      // ignoreDuplicates: anything filed meanwhile (e.g. by hand) is kept.
      const { error } = await db
        .from("grocery_item_aisles")
        .upsert(rows, { onConflict: "item_id,store_id", ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: "Couldn't save the aisles. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ filed: rows.length, left: unsorted.length - rows.length });
  } catch (error) {
    if (error instanceof SortError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Suggesting aisles failed", error);
    return NextResponse.json({ error: describeClaudeError(error) }, { status: 502 });
  }
}
