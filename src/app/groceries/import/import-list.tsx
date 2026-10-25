"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { importItems, type ImportRow } from "@/lib/groceries/db";
import type { ItemStatus } from "@/lib/groceries/types";
import { useGroceries } from "@/lib/groceries/use-groceries";
import { pastedLines, sameName } from "@/lib/groceries/views";
import { useSafeRouter } from "@/lib/navigation";
import type { SortResponse } from "@/app/api/groceries/sort/route";
import { LoadState } from "../parts";

type Row = ImportRow & { key: number; include: boolean; exists: boolean };

/** Paste a list (e.g. from Notes), let Claude sort it into home places, review, save. */
export function ImportList() {
  const router = useSafeRouter();
  const { data, loadFailed } = useGroceries();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState<"idle" | "sorting" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!data) return <LoadState failed={loadFailed} />;

  const lines = pastedLines(text);
  const placeNames = [...data.places].sort((a, b) => a.position - b.position).map((p) => p.name);

  const review = (items: { name: string; places: string[] }[]) =>
    setRows(
      items.map((item, key) => {
        const exists = data.items.some((i) => sameName(i.name, item.name));
        return { ...item, key, status: "have", include: !exists, exists };
      }),
    );

  async function sort() {
    setStatus("sorting");
    setError(null);
    try {
      const response = await fetch("/api/groceries/sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await response.json().catch(() => ({ error: "The server didn't answer. Please try again." }))) as SortResponse;
      if ("error" in body) setError(body.error);
      else review(body.items);
    } catch {
      setError("Couldn't reach the app. Check your connection.");
    }
    setStatus("idle");
  }

  async function save() {
    if (!rows || !data) return;
    setStatus("saving");
    setError(null);
    try {
      await importItems(rows.filter((r) => r.include && r.name.trim()), data);
      router.push("/groceries");
    } catch {
      setError("Couldn't save the list. Check your connection and try again.");
      setStatus("idle");
    }
  }

  const update = (key: number, change: Partial<Row>) => setRows((r) => r && r.map((row) => (row.key === key ? { ...row, ...change } : row)));

  if (!rows) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <p className="text-muted">
          Paste the whole list from Notes, one item per line. Claude will sort each item into your home places, and you can check
          everything before it&apos;s saved.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder={"Milk\nEggs\nParmigiano\nWashing-up liquid\n…"}
          className={`${ui.input} font-mono text-sm`}
        />
        {error && <p className={ui.error}>{error}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void sort()} disabled={lines.length === 0 || status === "sorting"} className={`${ui.primary} flex-1`}>
            {status === "sorting" ? "Sorting…" : `Sort ${lines.length || ""} items`}
          </button>
          <button
            type="button"
            onClick={() => review(lines.map((name) => ({ name, places: [] })))}
            disabled={lines.length === 0 || status === "sorting"}
            className={ui.secondary}
          >
            Skip sorting
          </button>
        </div>
      </div>
    );
  }

  const included = rows.filter((r) => r.include).length;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <p className="text-muted">
        Check the names and places. Everything comes in as <strong>have</strong>; tap <strong>Need</strong> on what you need to buy.
      </p>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.key} className={`${ui.card} flex flex-col gap-2 p-3 ${row.include ? "" : "opacity-50"}`}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.include}
                disabled={row.exists}
                onChange={(e) => update(row.key, { include: e.target.checked })}
                aria-label={`Import ${row.name}`}
                className="h-5 w-5 shrink-0 accent-brand"
              />
              <input
                value={row.name}
                onChange={(e) => update(row.key, { name: e.target.value })}
                aria-label="Name"
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 font-semibold focus:bg-bg focus:outline-none"
              />
              {row.exists ? (
                <span className="shrink-0 text-sm text-muted">Already on the list</span>
              ) : (
                <button
                  type="button"
                  onClick={() => update(row.key, { status: (row.status === "need" ? "have" : "need") as ItemStatus })}
                  className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${
                    row.status === "need" ? "border-accent bg-accent/25 text-ink" : "border-line text-muted"
                  }`}
                >
                  {row.status === "need" ? "Need" : "Have"}
                </button>
              )}
            </div>
            {row.include && (
              <div className="flex flex-wrap gap-1.5">
                {placeNames.map((place) => {
                  const on = row.places.some((p) => sameName(p, place));
                  return (
                    <button
                      key={place}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update(row.key, { places: on ? row.places.filter((p) => !sameName(p, place)) : [...row.places, place] })
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        on ? "border-brand bg-brand text-brand-ink" : "border-line text-muted"
                      }`}
                    >
                      {place}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && <p className={ui.error}>{error}</p>}
      <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <button type="button" onClick={() => void save()} disabled={included === 0 || status === "saving"} className={`${ui.primary} flex-1`}>
          {status === "saving" ? "Saving…" : `Add ${included} items`}
        </button>
        <button type="button" onClick={() => setRows(null)} disabled={status === "saving"} className={ui.secondary}>
          Back
        </button>
      </div>
    </div>
  );
}
