"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { similarItems } from "@/lib/groceries/from-recipe";
import type { Groceries } from "@/lib/groceries/types";
import { matchItems } from "@/lib/groceries/views";
import { AislesPicker, PlacesPicker } from "../../groceries/parts";

/** What an ingredient that isn't in Groceries yet turns out to be. */
export type Resolution =
  | { kind: "existing"; itemId: string }
  | { kind: "new"; name: string; places: string[]; aisles: Record<string, string>; isOneOff: boolean };

export const newItem = (name: string): Resolution => ({
  kind: "new",
  name: name.charAt(0).toUpperCase() + name.slice(1),
  places: [],
  aisles: {},
  isOneOff: false,
});

type Props = {
  name: string;
  data: Groceries;
  value: Resolution | null;
  onChange: (value: Resolution) => void;
};

/**
 * For an ingredient Groceries doesn't know by that name: pick the item it
 * is ("Parmigiano" for "Parmigiano Reggiano"), or set it up as a new item.
 */
export function NewIngredient({ name, data, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const suggested = similarItems(data.items, name);
  const found = query.trim() ? matchItems(data.items, query) : [];
  const choices = [...suggested, ...found.filter((f) => !suggested.some((s) => s.id === f.id))];

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Is it something already in Groceries?</h3>
        {choices.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {choices.map((item) => {
              const on = value?.kind === "existing" && value.itemId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ kind: "existing", itemId: item.id })}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left ${
                      on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"
                    }`}
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    {on && <span aria-hidden>✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <input
          type="search"
          autoComplete="off"
          placeholder={choices.length > 0 ? "Find another item…" : "Find an item…"}
          aria-label="Find an item in Groceries"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${ui.input} rounded-full px-4`}
        />
        {query.trim() && found.length === 0 && <p className="text-sm text-muted">No item matches “{query.trim()}”.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          aria-pressed={value?.kind === "new"}
          onClick={() => value?.kind !== "new" && onChange(newItem(name))}
          className={`min-h-11 rounded-xl border px-3 text-left font-semibold ${
            value?.kind === "new" ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"
          }`}
        >
          No, it&apos;s a new item
        </button>
        {value?.kind === "new" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-line p-4">
            <label>
              <span className={ui.label}>Name in Groceries</span>
              <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className={ui.input} />
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={value.isOneOff}
                onChange={(e) => onChange({ ...value, isOneOff: e.target.checked })}
                className="h-5 w-5 accent-brand"
              />
              <span>
                One-off <span className="text-sm text-muted">— deleted once bought</span>
              </span>
            </label>
            {!value.isOneOff && (
              <>
                <PlacesPicker places={data.places} value={value.places} onChange={(places) => onChange({ ...value, places })} />
                <AislesPicker data={data} value={value.aisles} onChange={(aisles) => onChange({ ...value, aisles })} />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
