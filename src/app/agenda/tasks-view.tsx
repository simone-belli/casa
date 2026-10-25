"use client";

import { useMemo, useState } from "react";
import type { Draft } from "@/lib/agenda/draft";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { useAgenda, useMySettings, useViewer } from "@/lib/agenda/use-agenda";
import { taskSections, type TaskEntry } from "@/lib/agenda/views";
import { useHousehold } from "@/lib/household";
import { AddBar } from "./add-bar";
import { ItemSheet } from "./item-sheet";
import { NudgeBanner } from "./nudge-banner";
import { ErrorBanner, GroupTitle, ItemList, ItemRow, LoadState, useAgendaActions } from "./parts";

/** Every task, dated or not, by who it's for. */
export function TasksView() {
  const { data, loadFailed, error, clearError, change } = useAgenda();
  const viewer = useViewer();
  const { nameOf } = useHousehold();
  const mySettings = useMySettings(viewer?.me ?? null);
  const actions = useAgendaActions(change);
  const [showDone, setShowDone] = useState(false);
  const [sheet, setSheet] = useState<{ draft: Draft } | { occ: Occurrence } | null>(null);

  const sections = useMemo(() => (data && viewer ? taskSections(data, viewer) : null), [data, viewer]);
  if (!data || !viewer || !sections) return <LoadState failed={loadFailed} />;

  const other = nameOf(viewer.other) ?? "Theirs";
  const groups: { key: string; title: string; entries: TaskEntry[]; accent?: boolean; empty?: string }[] = [
    { key: "waiting", title: "Waiting for your answer", entries: sections.waiting, accent: true },
    { key: "undecided", title: "Undecided", entries: sections.undecided },
    { key: "mine", title: "Mine", entries: sections.mine, empty: "Nothing on your list" },
    { key: "theirs", title: `${other}'s`, entries: sections.theirs },
    { key: "both", title: "Both of us", entries: sections.both },
  ];
  const open = (o: Occurrence) => setSheet({ occ: o });

  return (
    <div className="flex flex-col gap-4 pt-4">
      <NudgeBanner sections={sections} viewer={viewer} mySettings={mySettings} />
      <AddBar viewer={viewer} kind="task" onDraft={(draft) => setSheet({ draft })} />
      <ErrorBanner error={error} onDismiss={clearError} />

      {groups.map(
        (group) =>
          (group.entries.length > 0 || group.empty) && (
            <section key={group.key}>
              <GroupTitle count={group.entries.length || undefined}>{group.title}</GroupTitle>
              {group.entries.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">{group.empty}</p>
              ) : (
                <ItemList>
                  {group.entries.map((entry) => (
                    <ItemRow
                      key={entry.occ.key}
                      occ={entry.occ}
                      agenda={data}
                      viewer={viewer}
                      nameOf={nameOf}
                      actions={actions}
                      onOpen={open}
                      overdue={entry.overdue}
                    />
                  ))}
                </ItemList>
              )}
            </section>
          ),
      )}

      {sections.done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            aria-expanded={showDone}
            className="flex w-full items-baseline justify-between px-1 pb-1.5 text-sm font-semibold tracking-wide text-muted uppercase"
          >
            <span>
              {showDone ? "▾" : "▸"} Done
            </span>
            <span className="tabular-nums">{sections.done.length}</span>
          </button>
          {showDone && (
            <ItemList>
              {sections.done.map((occ) => (
                <ItemRow key={occ.key} occ={occ} agenda={data} viewer={viewer} nameOf={nameOf} actions={actions} onOpen={open} />
              ))}
            </ItemList>
          )}
        </section>
      )}

      {sheet && (
        <ItemSheet
          key={"occ" in sheet ? sheet.occ.key : "new"}
          target={sheet}
          agenda={data}
          viewer={viewer}
          nameOf={nameOf}
          change={change}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
