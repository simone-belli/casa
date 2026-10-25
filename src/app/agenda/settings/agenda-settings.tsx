"use client";

import { ui } from "@/components/ui";
import { useMySettings, useViewer } from "@/lib/agenda/use-agenda";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Settings → Agenda: my weekly nudge. */
export function AgendaSettings() {
  const viewer = useViewer();
  const { settings, failed, save } = useMySettings(viewer?.me ?? null);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <section className={`${ui.card} flex flex-col gap-4`}>
        <div>
          <h2 className="font-display text-xl">Weekly nudge</h2>
          <p className="text-sm text-muted">
            A banner at the top of Agenda listing undecided tasks and proposals waiting for your answer. Just for you.
          </p>
        </div>
        {settings ? (
          <>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.nudge_enabled}
                onChange={(e) => void save({ ...settings, nudge_enabled: e.target.checked })}
                className="h-5 w-5 accent-brand"
              />
              <span>Nudge me</span>
            </label>
            <label className={settings.nudge_enabled ? "" : "opacity-50"}>
              <span className={ui.label}>On</span>
              <select
                value={settings.nudge_weekday}
                disabled={!settings.nudge_enabled}
                onChange={(e) => void save({ ...settings, nudge_weekday: Number(e.target.value), nudge_dismissed_on: null })}
                className={ui.input}
              >
                {WEEKDAYS.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          !failed && <p className="text-muted">Loading…</p>
        )}
        {failed && <p className={ui.error}>Couldn&apos;t load or save your settings. Check your connection.</p>}
      </section>
    </div>
  );
}
