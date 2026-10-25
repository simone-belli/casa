import { normalise } from "@/lib/recipes/search";
import type { Aisle, Groceries, Item } from "./types";

export type Group = { key: string; title: string; items: Item[] };

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
const byPosition = <T extends { position: number; name: string }>(a: T, b: T) =>
  a.position - b.position || a.name.localeCompare(b.name);

/**
 * The home view: items grouped by home place, in the places' order. An item
 * in several places appears under each; items with no place go under
 * "Elsewhere", and one-offs under "One-offs". Empty groups are left out.
 */
export function homeGroups(data: Groceries, onlyNeeded: boolean): Group[] {
  const items = data.items.filter((i) => !onlyNeeded || i.status === "need").sort(byName);
  const placesOf = new Map<string, string[]>();
  for (const { item_id, place_id } of data.itemPlaces) {
    placesOf.set(item_id, [...(placesOf.get(item_id) ?? []), place_id]);
  }

  const groups: Group[] = [...data.places].sort(byPosition).map((place) => ({
    key: place.id,
    title: place.name,
    items: items.filter((i) => !i.is_one_off && placesOf.get(i.id)?.includes(place.id)),
  }));
  const placeIds = new Set(data.places.map((p) => p.id));
  groups.push({
    key: "elsewhere",
    title: "Elsewhere",
    items: items.filter((i) => !i.is_one_off && !placesOf.get(i.id)?.some((id) => placeIds.has(id))),
  });
  groups.push({ key: "one-offs", title: "One-offs", items: items.filter((i) => i.is_one_off) });
  return groups.filter((g) => g.items.length > 0);
}

export type ShopView = {
  oneOffs: Item[];
  unsorted: Item[];
  aisles: { aisle: Aisle; items: Item[] }[];
};

/** The shop view: only items we need, by the supermarket's aisles in walking order. */
export function shopView(data: Groceries, storeId: string): ShopView {
  const needed = data.items.filter((i) => i.status === "need").sort(byName);
  const aisles = data.aisles.filter((a) => a.store_id === storeId).sort(byPosition);
  const aisleIds = new Set(aisles.map((a) => a.id));
  const aisleOf = new Map(
    data.itemAisles.filter((f) => f.store_id === storeId && aisleIds.has(f.aisle_id)).map((f) => [f.item_id, f.aisle_id]),
  );
  return {
    oneOffs: needed.filter((i) => i.is_one_off),
    unsorted: needed.filter((i) => !i.is_one_off && !aisleOf.has(i.id)),
    aisles: aisles
      .map((aisle) => ({ aisle, items: needed.filter((i) => !i.is_one_off && aisleOf.get(i.id) === aisle.id) }))
      .filter((a) => a.items.length > 0),
  };
}

/** Same name, ignoring case, accents and surrounding spaces. */
export function sameName(a: string, b: string): boolean {
  return normalise(a.trim()) === normalise(b.trim());
}

/**
 * Items for quick add: those whose name contains every typed word, with names
 * starting with the query first.
 */
export function matchItems(items: Item[], query: string, limit = 6): Item[] {
  const q = normalise(query.trim());
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return items
    .filter((i) => {
      const name = normalise(i.name);
      return words.every((w) => name.includes(w));
    })
    .sort((a, b) => {
      const aStarts = normalise(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalise(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || byName(a, b);
    })
    .slice(0, limit);
}

/**
 * Lines of a pasted checklist (e.g. from Apple Notes), without checkbox
 * symbols, bullets or empty lines.
 */
export function pastedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^(?:[\s\-*•◦▪‣☐☑☒✓✔✅◯○●︎️]|\[[ xX✓]?\])+/u, "").trim())
    .filter(Boolean);
}
