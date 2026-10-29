import { normalise } from "@/lib/recipes/search";
import { NOT_SOLD, OTHER_PLACE, type Aisle, type Groceries, type Item, type ItemAisle, type Store } from "./types";

export type Group = { key: string; title: string; items: Item[] };

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
const byPosition = <T extends { position: number; name: string }>(a: T, b: T) =>
  a.position - b.position || a.name.localeCompare(b.name);

/**
 * The home view: items grouped by home place, in the places' order. An item
 * in several places appears under each; items with no place go under
 * "Other", and one-offs under "One-offs". When showing everything, every
 * place is listed even if empty; otherwise empty groups are left out.
 */
export function homeGroups(data: Groceries, onlyNeeded: boolean): Group[] {
  const items = data.items.filter((i) => !onlyNeeded || i.status === "need").sort(byName);
  const placesOf = new Map<string, string[]>();
  for (const { item_id, place_id } of data.itemPlaces) {
    placesOf.set(item_id, [...(placesOf.get(item_id) ?? []), place_id]);
  }

  const placeIds = new Set(data.places.map((p) => p.id));
  const unplaced = (i: Item) => !placesOf.get(i.id)?.some((id) => placeIds.has(id));
  const groups: Group[] = [...data.places].sort(byPosition).map((place) => ({
    key: place.id,
    title: place.name,
    items: items.filter(
      (i) => !i.is_one_off && (placesOf.get(i.id)?.includes(place.id) || (place.name === OTHER_PLACE && unplaced(i))),
    ),
  }));
  if (!data.places.some((p) => p.name === OTHER_PLACE)) {
    groups.push({ key: "other", title: OTHER_PLACE, items: items.filter((i) => !i.is_one_off && unplaced(i)) });
  }
  groups.push({ key: "one-offs", title: "One-offs", items: items.filter((i) => i.is_one_off) });
  return groups.filter((g) => g.items.length > 0 || (!onlyNeeded && g.key !== "one-offs" && g.key !== "other"));
}

/** Whether the store is a specialist shop (no aisles; new items aren't sold there). */
export const isShop = (store: Store | undefined) => store?.kind === "shop";

/** The hidden aisle of a specialist shop that holds what it sells, if it has one. */
export function shopAisle(data: Pick<Groceries, "aisles">, storeId: string): Aisle | undefined {
  return data.aisles.filter((a) => a.store_id === storeId).sort(byPosition)[0];
}

/**
 * The item's choice at a store for a picker: an aisle id, NOT_SOLD, or "" for
 * not sorted yet. A specialist shop has no "not sorted yet": anything not
 * filed under its aisle isn't sold there.
 */
export function filingChoice(data: Pick<Groceries, "stores" | "aisles" | "itemAisles">, itemId: string, storeId: string): string {
  const filing = data.itemAisles.find((f) => f.item_id === itemId && f.store_id === storeId);
  if (isShop(data.stores.find((s) => s.id === storeId))) {
    const aisle = shopAisle(data, storeId);
    return aisle && filing?.aisle_id === aisle.id ? aisle.id : NOT_SOLD;
  }
  return filing ? (filing.aisle_id ?? NOT_SOLD) : "";
}

export type ShopView = {
  oneOffs: Item[];
  unsorted: Item[];
  aisles: { aisle: Aisle; items: Item[] }[];
  /** Needed, but marked as not sold at this supermarket. */
  notSold: Item[];
};

/**
 * The shop view: only items we need, by the supermarket's aisles in walking
 * order. A specialist shop has a single list, and items not filed there count
 * as not sold.
 */
export function shopView(data: Groceries, storeId: string): ShopView {
  const needed = data.items.filter((i) => i.status === "need").sort(byName);
  const shop = isShop(data.stores.find((s) => s.id === storeId));
  const aisles = shop ? [shopAisle(data, storeId)].filter((a) => a !== undefined) : data.aisles.filter((a) => a.store_id === storeId).sort(byPosition);
  const aisleIds = new Set(aisles.map((a) => a.id));
  const filings = data.itemAisles.filter((f) => f.store_id === storeId);
  const aisleOf = new Map(filings.filter((f) => f.aisle_id && aisleIds.has(f.aisle_id)).map((f) => [f.item_id, f.aisle_id]));
  const notSold = new Set(filings.filter((f) => f.aisle_id === null).map((f) => f.item_id));
  if (shop) for (const i of needed) if (!aisleOf.has(i.id)) notSold.add(i.id);
  return {
    oneOffs: needed.filter((i) => i.is_one_off),
    notSold: needed.filter((i) => !i.is_one_off && notSold.has(i.id)),
    unsorted: needed.filter((i) => !i.is_one_off && !aisleOf.has(i.id) && !notSold.has(i.id)),
    aisles: aisles
      .map((aisle) => ({ aisle, items: needed.filter((i) => !i.is_one_off && aisleOf.get(i.id) === aisle.id) }))
      .filter((a) => a.items.length > 0),
  };
}

/**
 * Filings that put every regular item under one aisle of the supermarket, or
 * mark them all as not sold there (aisleId null). Unless `replace` is set,
 * items already filed there (or marked not sold) are left out.
 */
export function fileAllRows(data: Groceries, storeId: string, aisleId: string | null, replace: boolean): ItemAisle[] {
  const filed = new Set(data.itemAisles.filter((f) => f.store_id === storeId).map((f) => f.item_id));
  return data.items
    .filter((i) => !i.is_one_off && (replace || !filed.has(i.id)))
    .map((i) => ({ item_id: i.id, store_id: storeId, aisle_id: aisleId }));
}

/** The line under an item's name: how much we need and its note. */
export function itemDetail(item: Item): string | null {
  return [item.amount, item.note].filter(Boolean).join(" · ") || null;
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

const BULLET = /^\s*(?:[-*•◦▪‣☐☑☒✓✔✅◯○●]|\[[ xX✓]?\])/u;

/**
 * Splits a pasted list into parts of at most `max` lines for sorting. A
 * section starts at a blank line followed by a line without a bullet (its
 * heading); sections are kept whole where possible, and a section too long
 * for one part is split with its heading repeated, so every line is sorted
 * knowing which heading it was under.
 */
export function pastedChunks(text: string, max = 80): string[][] {
  const sections: { heading: string | null; lines: string[] }[] = [];
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = pastedLines(block);
    if (lines.length === 0) continue;
    const firstRaw = block.split(/\r?\n/).find((l) => l.trim()) ?? "";
    const startsSection = !BULLET.test(firstRaw);
    if (startsSection || sections.length === 0) {
      sections.push({ heading: startsSection ? lines[0] : null, lines: [...lines] });
    } else {
      sections[sections.length - 1].lines.push(...lines);
    }
  }

  // Sections too long for one part become several, each under the heading.
  const units = sections.flatMap(({ heading, lines }) => {
    if (lines.length <= max) return [lines];
    const items = heading ? lines.slice(1) : lines;
    const size = heading ? max - 1 : max;
    const pieces: string[][] = [];
    for (let i = 0; i < items.length; i += size) {
      pieces.push([...(heading ? [heading] : []), ...items.slice(i, i + size)]);
    }
    return pieces;
  });

  const chunks: string[][] = [];
  for (const unit of units) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + unit.length <= max) last.push(...unit);
    else chunks.push([...unit]);
  }
  return chunks;
}
