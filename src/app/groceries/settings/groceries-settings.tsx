"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { addAisle, addStore, remove, rename, reorder } from "@/lib/groceries/db";
import type { Groceries } from "@/lib/groceries/types";
import { useDeviceSetting, useGroceries } from "@/lib/groceries/use-groceries";
import { ErrorBanner, LoadState } from "../parts";
import { ListEditor } from "./list-editor";
import { SuggestAisles } from "./suggest-aisles";

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Puts rows in the order of `ids` (for showing a reorder straight away). */
function inOrder<T extends { id: string; position: number }>(rows: T[], ids: string[]): T[] {
  return rows.map((r) => (ids.includes(r.id) ? { ...r, position: ids.indexOf(r.id) } : r));
}

export function GroceriesSettings() {
  const { data, loadFailed, error, clearError, change } = useGroceries();
  const [showWho, setShowWho] = useDeviceSetting("groceries:showWho", false);
  const [storeName, setStoreName] = useState("");
  const [copyFrom, setCopyFrom] = useState("");

  if (!data) return <LoadState failed={loadFailed} />;

  const renameIn = (key: "stores" | "aisles", id: string, name: string) => (d: Groceries) => ({
    ...d,
    [key]: (d[key] as { id: string }[]).map((r) => (r.id === id ? { ...r, name } : r)),
  });

  const stores = [...data.stores].sort(byPosition);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <ErrorBanner error={error} onDismiss={clearError} />

      <section className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="font-display text-xl">On this phone</h2>
        <label className="flex items-center justify-between gap-3">
          <span>
            Show who added it
            <span className="block text-sm text-muted">A small name next to the things we need.</span>
          </span>
          <input type="checkbox" checked={showWho} onChange={(e) => setShowWho(e.target.checked)} className="h-6 w-6 shrink-0 accent-brand" />
        </label>
      </section>

      {stores.map((store) => (
        <section key={store.id} className={`${ui.card} flex flex-col gap-3`}>
          <div className="flex items-center gap-2">
            <input
              key={store.name}
              defaultValue={store.name}
              aria-label="Supermarket name"
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (!name) e.target.value = store.name;
                else if (name !== store.name) void change(renameIn("stores", store.id, name), () => rename("grocery_stores", store.id, name));
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 font-display text-xl focus:bg-bg focus:outline-none"
            />
            <button
              type="button"
              className={`${ui.danger} min-h-9 px-3 text-sm`}
              onClick={() => {
                if (!window.confirm(`Delete “${store.name}” and its aisles?`)) return;
                void change(
                  (d) => ({ ...d, stores: d.stores.filter((s) => s.id !== store.id) }),
                  () => remove("grocery_stores", store.id),
                );
              }}
            >
              Delete
            </button>
          </div>
          <p className="-mt-2 text-sm text-muted">Aisles in walking order.</p>
          <ListEditor
            rows={data.aisles.filter((a) => a.store_id === store.id).sort(byPosition)}
            noun="aisle"
            onAdd={(name) => void change(null, () => addAisle(store.id, name, data.aisles))}
            onRename={(id, name) => void change(renameIn("aisles", id, name), () => rename("grocery_aisles", id, name))}
            onReorder={(ids) => void change((d) => ({ ...d, aisles: inOrder(d.aisles, ids) }), () => reorder("grocery_aisles", ids))}
            onDelete={(aisle) => {
              if (!window.confirm(`Delete “${aisle.name}”? Its items go back to “Not sorted yet” here.`)) return;
              void change(
                (d) => ({ ...d, aisles: d.aisles.filter((a) => a.id !== aisle.id), itemAisles: d.itemAisles.filter((f) => f.aisle_id !== aisle.id) }),
                () => remove("grocery_aisles", aisle.id),
              );
            }}
          />
          <SuggestAisles store={store} data={data} />
          {stores.length > 1 && (
            <div className="flex justify-end gap-1 text-sm">
              <span className="self-center text-muted">Move supermarket</span>
              {([-1, 1] as const).map((by) => {
                const index = stores.indexOf(store);
                const target = index + by;
                return (
                  <button
                    key={by}
                    type="button"
                    disabled={target < 0 || target >= stores.length}
                    aria-label={`Move ${store.name} ${by < 0 ? "up" : "down"}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-bg disabled:opacity-25"
                    onClick={() => {
                      const ids = stores.map((s) => s.id);
                      [ids[index], ids[target]] = [ids[target], ids[index]];
                      void change((d) => ({ ...d, stores: inOrder(d.stores, ids) }), () => reorder("grocery_stores", ids));
                    }}
                  >
                    {by < 0 ? "↑" : "↓"}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}

      <form
        className={`${ui.card} flex flex-col gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!storeName.trim()) return;
          const name = storeName.trim();
          setStoreName("");
          setCopyFrom("");
          void change(null, () => addStore(name, data, copyFrom || undefined));
        }}
      >
        <h2 className="font-display text-xl">Add a supermarket</h2>
        <input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Name, e.g. Tesco Express" className={ui.input} />
        {stores.length > 0 && (
          <label>
            <span className={ui.label}>Start from</span>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={ui.input}>
              <option value="">Empty</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  A copy of {s.name}&apos;s aisles and sorting
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" disabled={!storeName.trim()} className={ui.primary}>
          Add supermarket
        </button>
      </form>

      <section className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="font-display text-xl">Import</h2>
        <p className="text-sm text-muted">Paste a list (e.g. from Notes) and sort it into home places.</p>
        <SafeLink href="/groceries/import" className={ui.secondary}>
          Paste a list
        </SafeLink>
      </section>
    </div>
  );
}
