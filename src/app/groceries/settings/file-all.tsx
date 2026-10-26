"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { fileItems } from "@/lib/groceries/db";
import { NOT_SOLD, type Groceries, type Store } from "@/lib/groceries/types";
import { fileAllRows } from "@/lib/groceries/views";

type Change = (edit: ((current: Groceries) => Groceries) | null, save: () => Promise<unknown>) => Promise<boolean>;

/**
 * Files every item under one aisle of this supermarket, or marks them all as
 * not sold here: handy for a shop that sells only a few of our things (a
 * pharmacy, a wine shop), where everything is marked not sold and the few it
 * does sell are then filed by hand.
 */
export function FileAll({ store, data, change }: { store: Store; data: Groceries; change: Change }) {
  const [choice, setChoice] = useState(NOT_SOLD);
  const [replace, setReplace] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);

  const aisles = data.aisles.filter((a) => a.store_id === store.id).sort((a, b) => a.position - b.position);
  // The chosen aisle may have been deleted meanwhile.
  const target = choice === NOT_SOLD || aisles.some((a) => a.id === choice) ? choice : NOT_SOLD;
  const aisleId = target === NOT_SOLD ? null : target;
  const rows = fileAllRows(data, store.id, aisleId, replace);
  const where = aisleId ? `under “${aisles.find((a) => a.id === aisleId)!.name}”` : "as not sold here";

  async function fileAll() {
    if (replace && !window.confirm(`File all ${rows.length} items at ${store.name} ${where}? This replaces how they're sorted there now.`)) return;
    setMessage(null);
    const filed = new Set(rows.map((r) => r.item_id));
    const saved = await change(
      (d) => ({ ...d, itemAisles: [...d.itemAisles.filter((f) => f.store_id !== store.id || !filed.has(f.item_id)), ...rows] }),
      () => fileItems(rows, replace),
    );
    setMessage(
      saved
        ? { text: `Filed ${rows.length} items ${where}. Change any with ⋯ on the item, or as you shop.`, failed: false }
        : { text: "Couldn't save that. Check your connection and try again.", failed: true },
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <label>
        <span className={ui.label}>File every item</span>
        <select value={target} onChange={(e) => setChoice(e.target.value)} className={ui.input}>
          <option value={NOT_SOLD}>Not sold here</option>
          {aisles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-3">
        <span>
          Include items already sorted
          <span className="block text-sm text-muted">Otherwise only those not sorted yet here.</span>
        </span>
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-6 w-6 shrink-0 accent-brand" />
      </label>
      <button type="button" onClick={() => void fileAll()} disabled={rows.length === 0} className={ui.secondary}>
        {rows.length === 0 ? "Nothing to file" : `File ${rows.length} items ${where}`}
      </button>
      {message && <p className={message.failed ? ui.error : "text-sm text-brand"}>{message.text}</p>}
    </div>
  );
}
