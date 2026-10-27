"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { uid } from "@/lib/uid";
import { NOT_SOLD, type Aisle, type Groceries, type Item, type ItemAisle, type ItemPlace, type ItemStatus, type Place, type Store } from "./types";

const TABLES = [
  "grocery_items",
  "grocery_places",
  "grocery_stores",
  "grocery_aisles",
  "grocery_item_places",
  "grocery_item_aisles",
] as const;

/** A name that's already taken by another item. */
export class DuplicateNameError extends Error {}

function check(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (error.code === "23505") throw new DuplicateNameError("There's already an item with that name.");
  throw error;
}

/** Supabase returns at most this many rows per request (its default limit). */
const PAGE = 1000;

/**
 * Every row of a table, fetched a page at a time: one request would be cut
 * off at PAGE rows without any error (filings grow with items × supermarkets).
 */
async function selectAll<T>(table: (typeof TABLES)[number], columns: string, orderBy: string[]): Promise<T[]> {
  const db = supabaseBrowser();
  const rows: T[] = [];
  for (;;) {
    let query = db.from(table).select(columns);
    for (const column of orderBy) query = query.order(column);
    const { data, error } = await query.range(rows.length, rows.length + PAGE - 1);
    check(error);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export async function loadGroceries(): Promise<Groceries> {
  const [items, places, stores, aisles, itemPlaces, itemAisles] = await Promise.all([
    selectAll<Item>("grocery_items", "*", ["id"]),
    selectAll<Place>("grocery_places", "id, name, position", ["id"]),
    selectAll<Store>("grocery_stores", "id, name, position", ["id"]),
    selectAll<Aisle>("grocery_aisles", "id, store_id, name, position", ["id"]),
    selectAll<ItemPlace>("grocery_item_places", "item_id, place_id", ["item_id", "place_id"]),
    selectAll<ItemAisle>("grocery_item_aisles", "item_id, store_id, aisle_id", ["item_id", "store_id"]),
  ]);
  return { items, places, stores, aisles, itemPlaces, itemAisles };
}

/** Calls `onChange` whenever anything in Groceries changes, by either person. */
export function watchGroceries(onChange: () => void): () => void {
  const supabase = supabaseBrowser();
  let channel = supabase.channel(`groceries:${uid()}`);
  for (const table of TABLES) {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange());
  }
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// --- Items ------------------------------------------------------------------

export async function setStatus(id: string, status: ItemStatus): Promise<void> {
  const { error } = await supabaseBrowser().from("grocery_items").update({ status }).eq("id", id);
  check(error);
}

export type NewItem = { id?: string; name: string; note?: string | null; amount?: string | null; status: ItemStatus; is_one_off: boolean };

export async function createItem(item: NewItem): Promise<string> {
  const id = item.id ?? uid();
  const { error } = await supabaseBrowser()
    .from("grocery_items")
    .insert({ ...item, id, name: item.name.trim() });
  check(error);
  return id;
}

export async function updateItem(id: string, fields: Partial<Pick<Item, "name" | "note" | "amount" | "is_one_off" | "status">>) {
  const { error } = await supabaseBrowser().from("grocery_items").update(fields).eq("id", id);
  check(error);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabaseBrowser().from("grocery_items").delete().eq("id", id);
  check(error);
}

/** Replaces the item's home places. */
export async function setItemPlaces(itemId: string, placeIds: string[]): Promise<void> {
  const db = supabaseBrowser();
  check((await db.from("grocery_item_places").delete().eq("item_id", itemId)).error);
  if (placeIds.length > 0) {
    check((await db.from("grocery_item_places").insert(placeIds.map((place_id) => ({ item_id: itemId, place_id })))).error);
  }
}

/**
 * Files the item under an aisle of the supermarket, marks it as not sold
 * there (NOT_SOLD), or un-files it (null).
 */
export async function fileItem(itemId: string, storeId: string, choice: string | null): Promise<void> {
  const db = supabaseBrowser();
  const { error } = choice
    ? await db
        .from("grocery_item_aisles")
        .upsert(
          { item_id: itemId, store_id: storeId, aisle_id: choice === NOT_SOLD ? null : choice },
          { onConflict: "item_id,store_id" },
        )
    : await db.from("grocery_item_aisles").delete().eq("item_id", itemId).eq("store_id", storeId);
  check(error);
}

/**
 * Saves many filings at once. Unless `replace` is set, items filed meanwhile
 * (e.g. on the other phone) keep their filing.
 */
export async function fileItems(rows: ItemAisle[], replace: boolean): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseBrowser()
    .from("grocery_item_aisles")
    .upsert(rows, { onConflict: "item_id,store_id", ignoreDuplicates: !replace });
  check(error);
}

// --- Supermarkets and aisles (home places are fixed) ------------------------

type Listed = "grocery_stores" | "grocery_aisles";

const nextPosition = (rows: { position: number }[]) => rows.reduce((max, r) => Math.max(max, r.position + 1), 0);

export async function addAisle(storeId: string, name: string, aisles: Aisle[]): Promise<void> {
  const position = nextPosition(aisles.filter((a) => a.store_id === storeId));
  check((await supabaseBrowser().from("grocery_aisles").insert({ store_id: storeId, name: name.trim(), position })).error);
}

export async function rename(table: Listed, id: string, name: string): Promise<void> {
  check((await supabaseBrowser().from(table).update({ name: name.trim() }).eq("id", id)).error);
}

export async function remove(table: Listed, id: string): Promise<void> {
  check((await supabaseBrowser().from(table).delete().eq("id", id)).error);
}

/** Saves a new order: each row's position becomes its index in `ids`. */
export async function reorder(table: Listed, ids: string[]): Promise<void> {
  const db = supabaseBrowser();
  const results = await Promise.all(ids.map((id, position) => db.from(table).update({ position }).eq("id", id)));
  for (const result of results) check(result.error);
}

/**
 * Adds a supermarket, empty or as a copy of another one's aisles and filings.
 * Returns the new supermarket's id.
 */
export async function addStore(name: string, data: Groceries, copyFrom?: string): Promise<string> {
  const db = supabaseBrowser();
  const storeId = uid();
  check((await db.from("grocery_stores").insert({ id: storeId, name: name.trim(), position: nextPosition(data.stores) })).error);
  if (!copyFrom) return storeId;

  const newAisleId = new Map<string, string>();
  const aisles = data.aisles
    .filter((a) => a.store_id === copyFrom)
    .map((a) => {
      newAisleId.set(a.id, uid());
      return { id: newAisleId.get(a.id)!, store_id: storeId, name: a.name, position: a.position };
    });
  if (aisles.length > 0) check((await db.from("grocery_aisles").insert(aisles)).error);

  const filings = data.itemAisles
    .filter((f) => f.store_id === copyFrom && (f.aisle_id === null || newAisleId.has(f.aisle_id)))
    .map((f) => ({ item_id: f.item_id, store_id: storeId, aisle_id: f.aisle_id && newAisleId.get(f.aisle_id)! }));
  if (filings.length > 0) check((await db.from("grocery_item_aisles").insert(filings)).error);
  return storeId;
}

// --- Import -----------------------------------------------------------------

export type ImportRow = { name: string; places: string[]; status: ItemStatus };

/**
 * Saves reviewed import rows: the items and their home places (by name;
 * unknown names are ignored). Names that already exist are skipped. Returns
 * how many items were added.
 */
export async function importItems(rows: ImportRow[], data: Groceries): Promise<number> {
  const db = supabaseBrowser();
  const placeIds = new Map(data.places.map((p) => [p.name.trim().toLowerCase(), p.id]));

  const taken = new Set(data.items.map((i) => i.name.trim().toLowerCase()));
  const items: { id: string; name: string; status: ItemStatus }[] = [];
  const links: ItemPlace[] = [];
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    if (!key || taken.has(key)) continue;
    taken.add(key);
    const id = uid();
    items.push({ id, name: row.name.trim(), status: row.status });
    for (const place of new Set(row.places.map((p) => p.trim().toLowerCase()))) {
      const placeId = placeIds.get(place);
      if (placeId) links.push({ item_id: id, place_id: placeId });
    }
  }
  if (items.length > 0) check((await db.from("grocery_items").insert(items)).error);
  if (links.length > 0) check((await db.from("grocery_item_places").insert(links)).error);
  return items.length;
}
