"use client";

import { useSafeRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { Stepper } from "@/components/stepper";
import { ui } from "@/components/ui";
import { type HouseholdSettings, loadHotMonths, loadSettings, saveHotMonths, saveSettings, useHousehold } from "@/lib/household";
import { portionsFor } from "@/lib/recipes/scaling";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SettingsForm() {
  const router = useSafeRouter();
  const { members, me } = useHousehold();
  const [settings, setSettings] = useState<HouseholdSettings | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    loadSettings().then(setSettings, () => setStatus("error"));
  }, []);

  async function save(next: HouseholdSettings) {
    setSettings(next);
    setStatus("saving");
    try {
      await saveSettings(next);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={`${ui.card} flex flex-col gap-4`}>
        <div>
          <h2 className="font-display text-xl">Family size</h2>
          <p className="text-sm text-muted">
            Recipes open scaled for this many people. A child counts as half an adult. Shared by both of you.
          </p>
        </div>
        {settings ? (
          <>
            <Stepper label="Adults" value={settings.default_adults} onChange={(v) => save({ ...settings, default_adults: v })} />
            <Stepper label="Children" value={settings.default_children} onChange={(v) => save({ ...settings, default_children: v })} />
            <p className="text-sm text-muted">
              = {portionsFor(settings.default_adults, settings.default_children)} portions
              {status === "saving" && " · Saving…"}
              {status === "saved" && " · Saved"}
            </p>
          </>
        ) : (
          <p className="text-muted">{status === "error" ? "Couldn't load settings." : "Loading…"}</p>
        )}
        {status === "error" && settings && <p className={ui.error}>Couldn&apos;t save. Check your connection.</p>}
      </section>

      <Seasons />

      <section className={`${ui.card} flex flex-col gap-3`}>
        <h2 className="font-display text-xl">Household</h2>
        <ul className="text-ink">
          {members.map((m) => (
            <li key={m.user_id}>
              {m.display_name}
              {m.user_id === me && <span className="text-muted"> (you)</span>}
            </li>
          ))}
        </ul>
        <button type="button" onClick={signOut} className={ui.secondary}>
          Sign out
        </button>
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
          Tick the months of the hot season; the others are the cold season. Ricettario&apos;s <em>In season</em> filter uses this. Shared
          by both of you.
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
