"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { deleteItem, fileItem, setItemPlaces, updateItem } from "@/lib/groceries/db";
import { NOT_SOLD, type Groceries, type Item } from "@/lib/groceries/types";
import type { useGroceries } from "@/lib/groceries/use-groceries";
import { AislesPicker, PlacesPicker } from "./parts";

type Props = {
  item: Item;
  data: Groceries;
  change: ReturnType<typeof useGroceries>["change"];
  onClose: () => void;
};

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Edit an item: name, note, amount needed, one-off, home places and its aisle in each supermarket. */
export function ItemSheet({ item, data, change, onClose }: Props) {
  const initialPlaces = data.itemPlaces.filter((p) => p.item_id === item.id).map((p) => p.place_id);
  const initialAisles = Object.fromEntries(
    data.itemAisles.filter((f) => f.item_id === item.id).map((f) => [f.store_id, f.aisle_id ?? NOT_SOLD]),
  );
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? "");
  const [amount, setAmount] = useState(item.amount ?? "");
  const [isOneOff, setIsOneOff] = useState(item.is_one_off);
  const [places, setPlaces] = useState<string[]>(initialPlaces);
  const [aisles, setAisles] = useState<Record<string, string>>(initialAisles);
  const [saving, setSaving] = useState(false);

  const stores = [...data.stores].sort(byPosition);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    // An amount only means something while we need the item (buying it clears it).
    const fields = {
      name: name.trim(),
      note: note.trim() || null,
      is_one_off: isOneOff,
      ...(item.status === "need" && { amount: amount.trim() || null }),
    };
    const placesChanged = places.length !== initialPlaces.length || places.some((p) => !initialPlaces.includes(p));
    const changedStores = stores.filter((s) => (aisles[s.id] ?? "") !== (initialAisles[s.id] ?? ""));
    const saved = await change(
      (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === item.id ? { ...i, ...fields } : i)),
        itemPlaces: [
          ...d.itemPlaces.filter((p) => p.item_id !== item.id),
          ...places.map((place_id) => ({ item_id: item.id, place_id })),
        ],
        itemAisles: [
          ...d.itemAisles.filter((f) => f.item_id !== item.id),
          ...Object.entries(aisles)
            .filter(([, choice]) => choice)
            .map(([store_id, choice]) => ({ item_id: item.id, store_id, aisle_id: choice === NOT_SOLD ? null : choice })),
        ],
      }),
      async () => {
        await updateItem(item.id, fields);
        if (placesChanged) await setItemPlaces(item.id, places);
        for (const store of changedStores) await fileItem(item.id, store.id, aisles[store.id] || null);
      },
    );
    setSaving(false);
    if (saved) onClose();
  }

  async function remove() {
    if (!window.confirm(`Delete “${item.name}”? It goes from every list.`)) return;
    onClose();
    await change((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }), () => deleteItem(item.id));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${item.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
      >
        <label>
          <span className={ui.label}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={ui.input} />
        </label>
        <label>
          <span className={ui.label}>Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the Oatly one, 2 packs" className={ui.input} />
        </label>
        {item.status === "need" && (
          <label>
            <span className={ui.label}>How much this time</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 600 g" className={ui.input} />
          </label>
        )}
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isOneOff} onChange={(e) => setIsOneOff(e.target.checked)} className="h-5 w-5 accent-brand" />
          <span>
            One-off <span className="text-sm text-muted">— deleted once bought</span>
          </span>
        </label>

        {!isOneOff && (
          <>
            <PlacesPicker places={data.places} value={places} onChange={setPlaces} />
            <AislesPicker data={data} value={aisles} onChange={setAisles} />
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className={`${ui.primary} flex-1`}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className={ui.secondary}>
            Cancel
          </button>
        </div>
        <button type="button" onClick={() => void remove()} className={ui.danger}>
          Delete item
        </button>
      </div>
    </div>
  );
}
