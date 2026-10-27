"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { createItem, setStatus } from "@/lib/groceries/db";
import type { Groceries, Item } from "@/lib/groceries/types";
import type { useGroceries } from "@/lib/groceries/use-groceries";
import { matchItems, sameName } from "@/lib/groceries/views";
import { uid } from "@/lib/uid";

type Props = {
  data: Groceries;
  change: ReturnType<typeof useGroceries>["change"];
  me: string | null;
  /** Called with a new regular item's id, e.g. to pick its home places. */
  onCreated?: (id: string) => void;
};

/** Type a name: mark an existing item as needed, or add a new one. */
export function QuickAdd({ data, change, me, onCreated }: Props) {
  const [query, setQuery] = useState("");
  const name = query.trim();
  const matches = matchItems(data.items, name);
  const exact = data.items.find((i) => sameName(i.name, name));

  const markNeeded = (item: Item) => {
    setQuery("");
    if (item.status === "need") return;
    void change(
      (d) => ({
        ...d,
        items: d.items.map((i) => (i.id === item.id ? { ...i, status: "need", needed_by: me, needed_at: new Date().toISOString() } : i)),
      }),
      () => setStatus(item.id, "need"),
    );
  };

  const add = async (isOneOff: boolean) => {
    if (!name) return;
    setQuery("");
    const now = new Date().toISOString();
    const item: Item = {
      id: uid(),
      name,
      note: null,
      amount: null,
      status: "need",
      is_one_off: isOneOff,
      needed_by: me,
      needed_at: now,
      created_at: now,
      updated_at: now,
    };
    const saved = await change(
      (d) => ({ ...d, items: [...d.items, item] }),
      () => createItem({ id: item.id, name, status: "need", is_one_off: isOneOff }),
    );
    if (saved && !isOneOff) onCreated?.(item.id);
  };

  return (
    <div className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (exact) markNeeded(exact);
          else void add(false);
        }}
      >
        <input
          type="search"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="Add something we need…"
          aria-label="Add something we need"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${ui.input} rounded-full px-4`}
        />
      </form>
      {name && (
        <ul className={`${ui.card} absolute inset-x-0 top-full z-20 mt-2 flex flex-col gap-1 p-2 shadow-lg`}>
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => markNeeded(item)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left active:bg-bg"
              >
                <span className="min-w-0 truncate">{item.name}</span>
                <span className={`shrink-0 text-sm font-semibold ${item.status === "need" ? "text-muted" : "text-brand"}`}>
                  {item.status === "need" ? "On the list" : "+ Need"}
                </span>
              </button>
            </li>
          ))}
          {!exact && (
            <li className="flex flex-wrap gap-2 px-1 pt-1">
              <button type="button" onClick={() => void add(false)} className={`${ui.primary} min-h-10 flex-1 px-4`}>
                Add “{name}”
              </button>
              <button type="button" onClick={() => void add(true)} className={`${ui.secondary} min-h-10 px-4`}>
                One-off
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
