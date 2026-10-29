"use client";

import { ui } from "@/components/ui";
import { HOME_PLACES, NOT_SOLD, type Groceries, type Place } from "@/lib/groceries/types";
import { isShop, shopAisle } from "@/lib/groceries/views";

/** A save error, dismissed with a tap. */
export function ErrorBanner({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <button type="button" onClick={onDismiss} className={`${ui.error} w-full text-left`}>
      {error} <span className="underline">OK</span>
    </button>
  );
}

export function LoadState({ failed }: { failed: boolean }) {
  return failed ? (
    <p className={ui.error}>Couldn&apos;t load the list. Check your connection.</p>
  ) : (
    <p className="py-10 text-center text-muted">Loading…</p>
  );
}

/** A heading over a group of items, e.g. "Fridge" or "Fruit & veg". */
export function GroupTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline justify-between px-1 pb-1.5 text-sm font-semibold tracking-wide text-muted uppercase">
      <span>{children}</span>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </h2>
  );
}

/** The round tick box used by both views; ticked means "we have it". */
export function Tick({ ticked }: { ticked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
        ticked ? "border-brand bg-brand text-brand-ink" : "border-accent bg-surface"
      }`}
    >
      {ticked && "✓"}
    </span>
  );
}

export function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${name}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-muted active:bg-bg"
    >
      ⋯
    </button>
  );
}

/** Warns when the database's home places aren't the fixed ones yet (a migration hasn't been run). */
export function PlacesCheck({ places }: { places: Place[] }) {
  const names = [...places].sort((a, b) => a.position - b.position).map((p) => p.name);
  if (names.join("|") === HOME_PLACES.join("|")) return null;
  return (
    <p className={ui.error}>
      The home places aren&apos;t set up yet ({names.join(", ") || "none"} instead of {HOME_PLACES.join(", ")}). In Supabase →
      SQL Editor, run <code>0003_fixed_home_places.sql</code> (safe to run again), then reload this page.
    </p>
  );
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** Pick an item's home places (any number). */
export function PlacesPicker({ places, value, onChange }: { places: Place[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset>
      <legend className={ui.label}>At home</legend>
      <div className="flex flex-wrap gap-2">
        {[...places].sort(byPosition).map((place) => {
          const on = value.includes(place.id);
          return (
            <button
              key={place.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((p) => p !== place.id) : [...value, place.id])}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"
              }`}
            >
              {place.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Pick an item's aisle in each supermarket: store id → aisle id, NOT_SOLD,
 * or "" for not sorted yet. A specialist shop only has sold or not sold
 * (its hidden aisle's id, or NOT_SOLD, which "" also means there).
 */
export function AislesPicker({
  data,
  value,
  onChange,
}: {
  data: Pick<Groceries, "stores" | "aisles">;
  value: Record<string, string>;
  onChange: (aisles: Record<string, string>) => void;
}) {
  if (data.stores.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={ui.label}>In the shops</legend>
      {[...data.stores].sort(byPosition).map((store) => {
        const shop = isShop(store);
        const soldHere = shop ? shopAisle(data, store.id) : undefined;
        return (
          <label key={store.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{store.name}</span>
            <select
              value={value[store.id] || (shop ? NOT_SOLD : "")}
              onChange={(e) => onChange({ ...value, [store.id]: e.target.value })}
              className={`${ui.input} w-auto max-w-[60%]`}
            >
              {!shop && <option value="">Not sorted yet</option>}
              <option value={NOT_SOLD}>Not sold here</option>
              {soldHere && <option value={soldHere.id}>Sold here</option>}
              {!shop &&
                data.aisles
                  .filter((a) => a.store_id === store.id)
                  .sort(byPosition)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
            </select>
          </label>
        );
      })}
    </fieldset>
  );
}
