"use client";

import { useEffect, useState } from "react";
import { SafeLink } from "@/components/safe-link";
import { ui } from "@/components/ui";
import { loadHotMonths, saveHotMonths } from "@/lib/household";

export function RicettarioSettings() {
  return (
    <div className="flex flex-col gap-6 pt-6">
      <Seasons />

      <section className={`${ui.card} flex flex-col gap-3`}>
        <div>
          <h2 className="font-display text-xl">Sort recipes into the menu</h2>
          <p className="text-sm text-muted">
            Claude reads your recipes and suggests their menu, diet and season boxes. You check them before anything is saved.
          </p>
        </div>
        <SafeLink href="/ricettario/sort" className={ui.secondary}>
          ✨ Sort recipes with Claude
        </SafeLink>
      </section>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Seasons() {
  const [hotMonths, setHotMonths] = useState<number[] | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "missing">("idle");

  useEffect(() => {
    loadHotMonths().then(setHotMonths, () => setStatus("missing"));
  }, []);

  async function toggle(month: number) {
    if (!hotMonths) return;
    const next = hotMonths.includes(month) ? hotMonths.filter((m) => m !== month) : [...hotMonths, month];
    setHotMonths(next);
    setStatus("saving");
    try {
      await saveHotMonths(next);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div>
        <h2 className="font-display text-xl">Seasons</h2>
        <p className="text-sm text-muted">
          Tick the months of the hot season; the others are the cold season. The <em>In season</em> box on the menu uses this. Shared by
          both of you.
        </p>
      </div>
      {hotMonths ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((name, i) => {
              const hot = hotMonths.includes(i + 1);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={hot}
                  onClick={() => toggle(i + 1)}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${hot ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted">
            ☀️ Hot: {hotMonths.length} {hotMonths.length === 1 ? "month" : "months"} · ❄️ Cold: {12 - hotMonths.length}
            {status === "saving" && " · Saving…"}
            {status === "saved" && " · Saved"}
          </p>
        </>
      ) : (
        <p className="text-muted">{status === "missing" ? "Seasons aren't set up yet (database migration 0009)." : "Loading…"}</p>
      )}
      {status === "error" && <p className={ui.error}>Couldn&apos;t save. Check your connection.</p>}
    </section>
  );
}
