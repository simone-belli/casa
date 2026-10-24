"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Stepper } from "@/components/stepper";
import { ui } from "@/components/ui";
import { type HouseholdSettings, loadSettings, saveSettings, useHousehold } from "@/lib/household";
import { portionsFor } from "@/lib/recipes/scaling";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SettingsForm() {
  const router = useRouter();
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
