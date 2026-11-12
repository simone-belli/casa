"use client";

import { useMemo } from "react";
import { SafeLink } from "@/components/safe-link";
import { assigneeLabel } from "@/lib/agenda/assign";
import { dayLabel, shortDay, timeLabel, whenLabel } from "@/lib/agenda/format";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { useAgenda, useViewer } from "@/lib/agenda/use-agenda";
import { homeSummary, owner, pendingProposal, type Viewer } from "@/lib/agenda/views";
import type { Agenda } from "@/lib/agenda/types";
import { useHousehold } from "@/lib/household";
import { openLink, proposalText } from "../agenda/parts";

/** How many undecided tasks are listed before "+ N more". */
const UNDECIDED_SHOWN = 3;

type NameOf = (id: string | null | undefined) => string | null;

/**
 * What needs seeing straight away, from Agenda: proposals waiting for my
 * answer, overdue tasks, the next three days and undecided tasks. Read only:
 * tapping an item opens it in Agenda.
 */
export function HomeAgenda() {
  const { data, loadFailed } = useAgenda();
  const viewer = useViewer();
  const { nameOf } = useHousehold();
  const summary = useMemo(() => (data && viewer ? homeSummary(data, viewer) : null), [data, viewer]);

  if (!data || !viewer || !summary) {
    return <p className="py-10 text-center text-muted">{loadFailed ? "Couldn't load the agenda. Check your connection." : "Loading…"}</p>;
  }

  const row = { agenda: data, viewer, nameOf };
  const taskLink = (occ: Occurrence) => openLink(occ.item.kind === "task" ? "/agenda/tasks" : "/agenda", occ);
  const nothing = summary.waiting.length + summary.overdue.length + summary.days.length + summary.undecided.length === 0;
  const moreUndecided = summary.undecided.length - UNDECIDED_SHOWN;

  return (
    <div className="flex flex-col gap-5">
      {summary.waiting.length > 0 && (
        <Group title="Waiting for your answer" accent>
          {summary.waiting.map((occ) => (
            <Row key={occ.key} occ={occ} href={taskLink(occ)} {...row} highlight />
          ))}
        </Group>
      )}

      {summary.overdue.length > 0 && (
        <Group title="Overdue" danger>
          {summary.overdue.map((occ) => (
            <Row key={occ.key} occ={occ} href={taskLink(occ)} {...row} overdue />
          ))}
        </Group>
      )}

      {summary.days.map((day) => (
        <Group key={day.date} title={dayTitle(day.date, viewer.today)}>
          {day.occurrences.map((occ) => (
            <Row key={`${occ.key}@${day.date}`} occ={occ} href={openLink("/agenda", occ)} {...row} day={day.date} />
          ))}
        </Group>
      ))}

      {summary.undecided.length > 0 && (
        <Group title="Undecided" count={summary.undecided.length}>
          {summary.undecided.slice(0, UNDECIDED_SHOWN).map((occ) => (
            <Row key={occ.key} occ={occ} href={taskLink(occ)} {...row} hideAssignee />
          ))}
          {moreUndecided > 0 && (
            <li>
              <SafeLink href="/agenda/tasks" className="block px-4 py-3 font-semibold text-brand active:opacity-70">
                + {moreUndecided} more
              </SafeLink>
            </li>
          )}
        </Group>
      )}

      {nothing && (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-muted">
          Nothing planned for the next three days.
        </p>
      )}
    </div>
  );
}

/** "Today · Thu 12 Nov", "Tomorrow · Fri 13 Nov", then just "Sat 14 Nov". */
function dayTitle(date: string, today: string): string {
  const label = dayLabel(date, today);
  return label === "Today" || label === "Tomorrow" ? `${label} · ${shortDay(date, today)}` : shortDay(date, today);
}

function Group({
  title,
  count,
  accent,
  danger,
  children,
}: {
  title: string;
  count?: number;
  accent?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const colour = danger ? "text-danger" : accent ? "text-accent" : "text-muted";
  return (
    <section>
      <h2 className={`flex items-baseline justify-between px-1 pb-1.5 text-sm font-semibold tracking-wide uppercase ${colour}`}>
        <span>{title}</span>
        {count !== undefined && <span className="tabular-nums">{count}</span>}
      </h2>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">{children}</ul>
    </section>
  );
}

type RowProps = {
  occ: Occurrence;
  href: string;
  agenda: Agenda;
  viewer: Viewer;
  nameOf: NameOf;
  /** Grouped by day: show the time on that day. Otherwise the date and time. */
  day?: string;
  overdue?: boolean;
  highlight?: boolean;
  /** In a group where everything has the same assignee. */
  hideAssignee?: boolean;
};

/** One item, linking to it in Agenda: time, title, assignee and proposal state. */
function Row({ occ, href, agenda, viewer, nameOf, day, overdue, highlight, hideAssignee }: RowProps) {
  const item = occ.item;
  const main = owner(occ);
  const pending = pendingProposal(agenda.proposals, main.id);
  const when = day ? timeLabel(occ, day, viewer.timeZone) : whenLabel(occ, viewer.today, viewer.timeZone);

  return (
    <li className={`border-b border-line last:border-b-0 ${highlight ? "bg-accent/10" : ""}`}>
      <SafeLink href={href} className="flex min-h-12 items-start gap-3 px-4 py-2.5 active:bg-line/60">
        {item.kind === "task" ? (
          <span aria-label="Task" className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 ${occ.done ? "border-brand bg-brand" : "border-brand/60"}`} />
        ) : (
          <span aria-label="Event" className="flex h-6 w-5 shrink-0 items-center justify-center">
            <span className="h-3 w-3 rounded-full bg-accent" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate ${occ.done ? "text-muted line-through" : "font-medium text-ink"}`}>{item.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            {when && <span className={overdue ? "font-semibold text-danger" : ""}>{when}</span>}
            {occ.series && <span aria-label="Repeats">↻</span>}
            {pending && <span className="font-semibold text-accent">{proposalText(pending, viewer, nameOf)}</span>}
          </span>
        </span>
        {!hideAssignee && (
          <span className="mt-0.5 shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-muted">
            {assigneeLabel(main.assignees, viewer.me, (id) => nameOf(id))}
          </span>
        )}
      </SafeLink>
    </li>
  );
}
