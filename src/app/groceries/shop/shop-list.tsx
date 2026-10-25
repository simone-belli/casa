"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { createItem, deleteItem, fileItem, setStatus } from "@/lib/groceries/db";
import { NOT_SOLD, type Item } from "@/lib/groceries/types";
import { useDeviceSetting, useGroceries } from "@/lib/groceries/use-groceries";
import { shopView } from "@/lib/groceries/views";
import { useHousehold } from "@/lib/household";
import { ItemSheet } from "../item-sheet";
import { EditButton, ErrorBanner, GroupTitle, LoadState, Tick } from "../parts";
import { QuickAdd } from "../quick-add";

/**
 * The shop view: only what we need, in the chosen supermarket's aisle order.
 * Ticking an item marks it as "have" straight away; it stays greyed out under
 * "In the trolley" on this phone until the view is left, so a slip can be undone.
 */
export function ShopList() {
  const { data, loadFailed, error, clearError, change } = useGroceries();
  const { me, nameOf } = useHousehold();
  const [storeId, setStoreId] = useDeviceSetting<string | null>("groceries:store", null);
  const [showWho] = useDeviceSetting("groceries:showWho", false);
  const [trolley, setTrolley] = useState<Item[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  if (!data) return <LoadState failed={loadFailed} />;

  const stores = [...data.stores].sort((a, b) => a.position - b.position);
  if (stores.length === 0) {
    return (
      <div className={`${ui.card} mt-4 flex flex-col items-center gap-3 py-8 text-center`}>
        <p className="font-display text-xl">No supermarkets yet</p>
        <p className="max-w-xs text-muted">Add the supermarkets you shop at, with their aisles in walking order.</p>
        <SafeLink href="/groceries/settings" className={ui.primary}>
          Add a supermarket
        </SafeLink>
      </div>
    );
  }

  const store = stores.find((s) => s.id === storeId) ?? stores[0];
  const view = shopView(data, store.id);
  const storeAisles = data.aisles.filter((a) => a.store_id === store.id).sort((a, b) => a.position - b.position);
  const inTrolley = trolley.filter((t) => data.items.find((i) => i.id === t.id)?.status !== "need");
  const nothingToBuy = view.oneOffs.length + view.unsorted.length + view.aisles.length === 0;

  const tick = (item: Item) => {
    setTrolley((t) => [item, ...t.filter((i) => i.id !== item.id)]);
    void change(
      (d) => ({
        ...d,
        items: item.is_one_off
          ? d.items.filter((i) => i.id !== item.id)
          : d.items.map((i) => (i.id === item.id ? { ...i, status: "have", needed_by: null, needed_at: null } : i)),
      }),
      () => (item.is_one_off ? deleteItem(item.id) : setStatus(item.id, "have")),
    );
  };

  const untick = (item: Item) => {
    setTrolley((t) => t.filter((i) => i.id !== item.id));
    const back: Item = { ...item, status: "need" };
    void change(
      (d) => ({
        ...d,
        items: d.items.some((i) => i.id === item.id) ? d.items.map((i) => (i.id === item.id ? back : i)) : [...d.items, back],
      }),
      () =>
        item.is_one_off
          ? createItem({ id: item.id, name: item.name, note: item.note, status: "need", is_one_off: true })
          : setStatus(item.id, "need"),
    );
  };

  const file = (item: Item, choice: string) =>
    void change(
      (d) => ({
        ...d,
        itemAisles: [...d.itemAisles, { item_id: item.id, store_id: store.id, aisle_id: choice === NOT_SOLD ? null : choice }],
      }),
      () => fileItem(item.id, store.id, choice),
    );

  const row = (item: Item, sortable = false) => {
    const who = showWho ? nameOf(item.needed_by) : null;
    return (
      <li key={item.id} className="flex flex-col border-b border-line last:border-b-0">
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => tick(item)}
            aria-label={`Got ${item.name}`}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-bg"
          >
            <Tick ticked={false} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{item.name}</span>
              {item.note && <span className="block truncate text-sm text-muted">{item.note}</span>}
            </span>
          </button>
          {who && <span className="shrink-0 pl-2 text-xs text-muted">{who}</span>}
          <EditButton name={item.name} onClick={() => setEditing(item.id)} />
        </div>
        {sortable && (
          <select
            value=""
            onChange={(e) => e.target.value && file(item, e.target.value)}
            aria-label={`Aisle for ${item.name}`}
            className="mx-4 mb-2 -mt-1 rounded-lg border border-dashed border-line bg-bg px-2 py-1.5 text-sm text-muted"
          >
            <option value="">Which aisle? (remembered for next time)</option>
            <option value={NOT_SOLD}>Not sold here</option>
            {storeAisles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </li>
    );
  };

  const group = (key: string, title: string, items: Item[], sortable = false) => (
    <section key={key}>
      <GroupTitle count={items.length}>{title}</GroupTitle>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">{items.map((i) => row(i, sortable))}</ul>
    </section>
  );

  const editingItem = data.items.find((i) => i.id === editing);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Supermarket">
        {stores.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === store.id}
            onClick={() => setStoreId(s.id)}
            className={`shrink-0 rounded-full border px-4 py-2 font-semibold ${
              s.id === store.id ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <QuickAdd data={data} change={change} me={me} />
      <ErrorBanner error={error} onDismiss={clearError} />

      {nothingToBuy && inTrolley.length === 0 && <p className="py-10 text-center text-muted">Nothing to buy. 🎉</p>}
      {nothingToBuy && inTrolley.length > 0 && <p className="py-4 text-center font-semibold text-brand">All done! 🎉</p>}

      {view.oneOffs.length > 0 && group("one-offs", "One-offs", view.oneOffs)}
      {view.unsorted.length > 0 && (
        <>
          {group("unsorted", "Not sorted yet", view.unsorted, true)}
          {storeAisles.length === 0 && (
            <p className="-mt-2 px-1 text-sm text-muted">
              Add {store.name}&apos;s aisles in <SafeLink href="/groceries/settings" className="underline">settings</SafeLink> to sort these as you shop.
            </p>
          )}
        </>
      )}
      {view.aisles.map(({ aisle, items }) => group(aisle.id, aisle.name, items))}

      {view.notSold.length > 0 && (
        <p className="px-1 text-sm text-muted">
          Not sold at {store.name}: {view.notSold.map((i) => i.name).join(", ")}.
        </p>
      )}

      {inTrolley.length > 0 && (
        <section>
          <GroupTitle count={inTrolley.length}>In the trolley</GroupTitle>
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface/60">
            {inTrolley.map((item) => (
              <li key={item.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => untick(item)}
                  aria-label={`Put ${item.name} back on the list`}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg"
                >
                  <Tick ticked />
                  <span className="truncate text-muted line-through">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editingItem && <ItemSheet item={editingItem} data={data} change={change} onClose={() => setEditing(null)} />}
    </div>
  );
}
