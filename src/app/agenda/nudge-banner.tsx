"use client";

import { SafeLink } from "@/components/safe-link";
import type { useMySettings } from "@/lib/agenda/use-agenda";
import { nudge, type TaskSections, type Viewer } from "@/lib/agenda/views";

type Props = {
  sections: TaskSections;
  viewer: Viewer;
  mySettings: ReturnType<typeof useMySettings>;
};

/** The weekly nudge about undecided tasks and proposals waiting for an answer. */
export function NudgeBanner({ sections, viewer, mySettings }: Props) {
  const { settings, save } = mySettings;
  if (!settings) return null;
  const counts = nudge(sections, settings, viewer.today);
  if (!counts) return null;

  const parts = [
    counts.waiting > 0 && `${counts.waiting} waiting for your answer`,
    counts.undecided > 0 && `${counts.undecided} undecided task${counts.undecided === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-accent bg-accent/15 p-3">
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Weekly check-in:</span> {parts.join(" and ")}.{" "}
        <SafeLink href="/agenda/tasks" className="font-semibold text-brand underline">
          Go through them
        </SafeLink>
      </p>
      <button
        type="button"
        onClick={() => void save({ ...settings, nudge_dismissed_on: viewer.today })}
        aria-label="Dismiss"
        className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-muted active:bg-white/50"
      >
        ✕
      </button>
    </div>
  );
}
