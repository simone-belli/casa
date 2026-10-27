"use client";

import { useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { setStatus } from "@/lib/groceries/db";
import type { Item } from "@/lib/groceries/types";
import { useDeviceSetting } from "@/lib/device-setting";
import { useGroceries } from "@/lib/groceries/use-groceries";
import { homeGroups, itemDetail } from "@/lib/groceries/views";
import { useHousehold } from "@/lib/household";
import { ItemSheet } from "./item-sheet";
import { EditButton, ErrorBanner, GroupTitle, LoadState, PlacesCheck, Tick } from "./parts";
import { QuickAdd } from "./quick-add";

/** The home view: everything, by home place; tap to switch between have and need. */
export function HomeList() {
  const { data, loadFailed, error, clearError, change } = useGroceries();
  const { me, nameOf } = useHousehold();
  const [onlyNeeded, setOnlyNeeded] = useDeviceSetting("groceries:onlyNeeded", false);
  const [showWho] = useDeviceSetting("groceries:showWho", false);
  const [editing, setEditing] = useState<string | null>(null);

  if (!data) return <LoadState failed={loadFailed} />;

  const toggle = (item: Item) => {
    const status = item.status === "need" ? "have" : "need";
    void change(
      (d) => ({
        ...d,
        items: d.items.map((i) =>
          i.id === item.id
            ? status === "need"
              ? { ...i, status, needed_by: me, needed_at: new Date().toISOString() }
              : { ...i, status, needed_by: null, needed_at: null, amount: null }
            : i,
        ),
      }),
      () => setStatus(item.id, status),
    );
  };

  const groups = homeGroups(data, onlyNeeded);
  const neededCount = data.items.filter((i) => i.status === "need").length;
  const editingItem = data.items.find((i) => i.id === editing);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <QuickAdd data={data} change={change} me={me} onCreated={setEditing} />
      <ErrorBanner error={error} onDismiss={clearError} />
      <PlacesCheck places={data.places} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted">
          {neededCount === 0 ? "Nothing to buy" : `${neededCount} to buy`}
        </p>
        <div className="flex rounded-full border border-line bg-surface p-0.5 text-sm font-semibold" role="group" aria-label="Show">
          {[
            { value: false, label: "All" },
            { value: true, label: "To buy" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={onlyNeeded === option.value}
              onClick={() => setOnlyNeeded(option.value)}
              className={`rounded-full px-3 py-1.5 ${onlyNeeded === option.value ? "bg-brand text-brand-ink" : "text-muted"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {data.items.length === 0 && (
        <div className={`${ui.card} flex flex-col items-center gap-3 py-8 text-center`}>
          <p className="font-display text-xl">The list is empty</p>
          <p className="max-w-xs text-muted">Paste in the list from Notes to get started, or add things one by one above.</p>
          <SafeLink href="/groceries/import" className={ui.primary}>
            Paste a list
          </SafeLink>
        </div>
      )}

      {data.items.length > 0 && groups.map((group) => (
        <section key={group.key}>
          <GroupTitle count={group.items.filter((i) => i.status === "need").length || undefined}>{group.title}</GroupTitle>
          {group.items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">Nothing here yet</p>
          )}
          {group.items.length > 0 && <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {group.items.map((item) => {
              const needed = item.status === "need";
              const who = showWho && needed ? nameOf(item.needed_by) : null;
              return (
                <li key={item.id} className={`flex items-center border-b border-line last:border-b-0 ${needed ? "bg-accent/15" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-pressed={!needed}
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left active:bg-bg"
                  >
                    <Tick ticked={!needed} />
                    <span className="min-w-0">
                      <span className={`block truncate ${needed ? "font-semibold text-ink" : "text-muted"}`}>{item.name}</span>
                      {itemDetail(item) && <span className="block truncate text-sm text-muted">{itemDetail(item)}</span>}
                    </span>
                  </button>
                  {who && <span className="shrink-0 pl-2 text-xs text-muted">{who}</span>}
                  <EditButton name={item.name} onClick={() => setEditing(item.id)} />
                </li>
              );
            })}
          </ul>}
        </section>
      ))}

      {data.items.length > 0 && groups.length === 0 && <p className="py-10 text-center text-muted">Nothing to buy. 🎉</p>}

      {editingItem && <ItemSheet item={editingItem} data={data} change={change} onClose={() => setEditing(null)} />}
    </div>
  );
}
