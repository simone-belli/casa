"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { uid } from "@/lib/uid";
import type { Aisle, Groceries, Item, ItemAisle, ItemPlace, ItemStatus, Place, Store } from "./types";

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

export async function loadGroceries(): Promise<Groceries> {
  const db = supabaseBrowser();
  const [items, places, stores, aisles, itemPlaces, itemAisles] = await Promise.all([
    db.from("grocery_items").select("*"),
    db.from("grocery_places").select("id, name, position"),
    db.from("grocery_stores").select("id, name, position"),
    db.from("grocery_aisles").select("id, store_id, name, position"),
    db.from("grocery_item_places").select("item_id, place_id"),
    db.from("grocery_item_aisles").select("item_id, store_id, aisle_id"),
  ]);
  for (const result of [items, places, stores, aisles, itemPlaces, itemAisles]) check(result.error);
  return {
    items: items.data as Item[],
    places: places.data as Place[],
    stores: stores.data as Store[],
    aisles: aisles.data as Aisle[],
    itemPlaces: itemPlaces.data as ItemPlace[],
    itemAisles: itemAisles.data as ItemAisle[],
  };
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

export type NewItem = { id?: string; name: string; note?: string | null; status: ItemStatus; is_one_off: boolean };

export async function createItem(item: NewItem): Promise<string> {
  const id = item.id ?? uid();
  const { error } = await supabaseBrowser()
    .from("grocery_items")
    .insert({ ...item, id, name: item.name.trim() });
  check(error);
  return id;
}

export async function updateItem(id: string, fields: Partial<Pick<Item, "name" | "note" | "is_one_off" | "status">>) {
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

/** Files the item under an aisle of the supermarket, or un-files it (null). */
export async function fileItem(itemId: string, storeId: string, aisleId: string | null): Promise<void> {
  const db = supabaseBrowser();
  const { error } = aisleId
    ? await db
        .from("grocery_item_aisles")
        .upsert({ item_id: itemId, store_id: storeId, aisle_id: aisleId }, { onConflict: "item_id,store_id" })
    : await db.from("grocery_item_aisles").delete().eq("item_id", itemId).eq("store_id", storeId);
  check(error);
}

// --- Places, supermarkets and aisles ----------------------------------------

type Listed = "grocery_places" | "grocery_stores" | "grocery_aisles";

const nextPosition = (rows: { position: number }[]) => rows.reduce((max, r) => Math.max(max, r.position + 1), 0);

export async function addPlace(name: string, places: Place[]): Promise<string> {
  const id = uid();
  check((await supabaseBrowser().from("grocery_places").insert({ id, name: name.trim(), position: nextPosition(places) })).error);
  return id;
}

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
    .filter((f) => f.store_id === copyFrom && newAisleId.has(f.aisle_id))
    .map((f) => ({ item_id: f.item_id, store_id: storeId, aisle_id: newAisleId.get(f.aisle_id)! }));
  if (filings.length > 0) check((await db.from("grocery_item_aisles").insert(filings)).error);
  return storeId;
}

// --- Import -----------------------------------------------------------------

export type ImportRow = { name: string; places: string[]; status: ItemStatus };

/**
 * Saves reviewed import rows: creates any new places (by name), then the
 * items and their places. Names that already exist are skipped. Returns how
 * many items were added.
 */
export async function importItems(rows: ImportRow[], data: Groceries): Promise<number> {
  const db = supabaseBrowser();
  const placeIds = new Map(data.places.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const newPlaces: { id: string; name: string; position: number }[] = [];
  let position = nextPosition(data.places);
  for (const name of rows.flatMap((r) => r.places)) {
    const key = name.trim().toLowerCase();
    if (!key || placeIds.has(key)) continue;
    const id = uid();
    placeIds.set(key, id);
    newPlaces.push({ id, name: name.trim(), position: position++ });
  }
  if (newPlaces.length > 0) check((await db.from("grocery_places").insert(newPlaces)).error);

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
