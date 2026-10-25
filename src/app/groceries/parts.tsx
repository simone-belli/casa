"use client";

import { ui } from "@/components/ui";
import { HOME_PLACES, type Place } from "@/lib/groceries/types";

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
