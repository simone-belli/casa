"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { fileItem } from "@/lib/groceries/db";
import type { Groceries, Item, Store } from "@/lib/groceries/types";
import { matchItems, shopAisle } from "@/lib/groceries/views";

type Change = (edit: ((current: Groceries) => Groceries) | null, save: () => Promise<unknown>) => Promise<boolean>;

/**
 * What a specialist shop sells: the few items filed there. Everything else,
 * including items added later, isn't sold there.
 */
export function ShopItems({ store, data, change }: { store: Store; data: Groceries; change: Change }) {
  const [query, setQuery] = useState("");
  const aisle = shopAisle(data, store.id);
  if (!aisle) return <p className={ui.error}>{store.name} isn&apos;t set up properly. Delete it and add it again.</p>;

  const soldIds = new Set(data.itemAisles.filter((f) => f.store_id === store.id && f.aisle_id === aisle.id).map((f) => f.item_id));
  const sold = data.items.filter((i) => soldIds.has(i.id)).sort((a, b) => a.name.localeCompare(b.name));
  const matches = matchItems(
    data.items.filter((i) => !i.is_one_off && !soldIds.has(i.id)),
    query,
  );

  const setSold = (item: Item, on: boolean) =>
    void change(
      (d) => ({
        ...d,
        itemAisles: [
          ...d.itemAisles.filter((f) => f.item_id !== item.id || f.store_id !== store.id),
          ...(on ? [{ item_id: item.id, store_id: store.id, aisle_id: aisle.id }] : []),
        ],
      }),
      () => fileItem(item.id, store.id, on ? aisle.id : null),
    );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {sold.length === 0
          ? "Nothing sold here yet. Add the few things you buy here; new items start as not sold here."
          : "What you buy here. Anything else, and new items, aren't sold here."}
      </p>
      {sold.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sold.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSold(item, false)}
                aria-label={`${item.name} isn't sold at ${store.name}`}
                className="flex items-center gap-1.5 rounded-full border border-brand bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink"
              >
                {item.name} <span aria-hidden>✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="search"
        autoComplete="off"
        placeholder="Add something sold here…"
        aria-label={`Add something sold at ${store.name}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`${ui.input} rounded-full px-4`}
      />
      {query.trim() && (
        <ul className="flex flex-col gap-1">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setSold(item, true);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:bg-bg"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 text-sm font-semibold text-brand">+ Sold here</span>
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 text-sm text-muted">No other item matches “{query.trim()}”.</li>}
        </ul>
      )}
    </div>
  );
}
