"use client";

import { ui } from "@/components/ui";
import { assigneeLabel } from "@/lib/agenda/assign";
import { acknowledgeDecline, answerProposal, occurrenceRow, setDone } from "@/lib/agenda/db";
import { timeLabel, whenLabel } from "@/lib/agenda/format";
import type { Occurrence } from "@/lib/agenda/occurrences";
import type { Agenda, AgendaItem, Proposal } from "@/lib/agenda/types";
import type { useAgenda } from "@/lib/agenda/use-agenda";
import { owner, pendingProposal, unseenDecline, type Viewer } from "@/lib/agenda/views";
import { uid } from "@/lib/uid";

type Change = ReturnType<typeof useAgenda>["change"];
type NameOf = (id: string | null | undefined) => string | null;

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
    <p className={ui.error}>Couldn&apos;t load the agenda. Check your connection.</p>
  ) : (
    <p className="py-10 text-center text-muted">Loading…</p>
  );
}

/** A heading over a group, e.g. "Today" or "Undecided". */
export function GroupTitle({ children, count, accent }: { children: React.ReactNode; count?: number; accent?: boolean }) {
  return (
    <h2 className={`flex items-baseline justify-between px-1 pb-1.5 text-sm font-semibold tracking-wide uppercase ${accent ? "text-danger" : "text-muted"}`}>
      <span>{children}</span>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </h2>
  );
}

/** The square tick box on tasks. */
export function TaskTick({ done, label, onToggle }: { done: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={done}
      aria-label={done ? `Reopen ${label}` : `Tick off ${label}`}
      className="-my-2 -ml-2 flex h-11 w-11 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={`flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold ${
          done ? "border-brand bg-brand text-brand-ink" : "border-brand/60 bg-surface"
        }`}
      >
        {done && "✓"}
      </span>
    </button>
  );
}

/** Ticking off, answering proposals and acknowledging declines, with the screen updated straight away. */
export function useAgendaActions(change: Change) {
  return {
    toggleDone(occ: Occurrence) {
      const done = !occ.done;
      const task_status = done ? "done" : "open";
      const now = new Date().toISOString();
      void change(
        (d) => {
          if (!occ.series) {
            return { ...d, items: d.items.map((i) => (i.id === occ.item.id ? { ...i, task_status, done_at: done ? now : null } : i)) };
          }
          if (occ.exception) {
            return { ...d, items: d.items.map((i) => (i.id === occ.exception!.id ? { ...i, task_status, done_at: done ? now : null } : i)) };
          }
          const row: AgendaItem = {
            ...occ.series,
            ...occurrenceRow(occ, occ.series),
            id: uid(),
            recurrence: null,
            keep_missed: false,
            cancelled: false,
            task_status,
            done_at: done ? now : null,
            created_at: now,
            updated_at: now,
          };
          return { ...d, items: [...d.items, row] };
        },
        () => setDone(occ, done),
      );
    },
    answer(proposal: Proposal, accept: boolean) {
      void change(
        (d) => ({
          proposals: d.proposals.map((p) => (p.id === proposal.id ? { ...p, status: accept ? "accepted" : "declined" } : p)),
          items: d.items.map((i) =>
            i.id === proposal.item_id ? { ...i, assignees: accept ? proposal.proposed_assignees : [proposal.proposed_by] } : i,
          ),
        }),
        () => answerProposal(proposal.id, accept),
      );
    },
    acknowledge(proposal: Proposal) {
      const now = new Date().toISOString();
      void change(
        (d) => ({ ...d, proposals: d.proposals.map((p) => (p.id === proposal.id ? { ...p, acknowledged_at: now } : p)) }),
        () => acknowledgeDecline(proposal.id),
      );
    },
  };
}

type Actions = ReturnType<typeof useAgendaActions>;

/** "Proposed to Kat", "Kat proposed: Both" and the like, for an item's pending proposal. */
export function proposalText(proposal: Proposal, viewer: Viewer, nameOf: NameOf): string {
  const to = assigneeLabel(proposal.proposed_assignees, viewer.me, (id) => nameOf(id));
  if (proposal.proposed_by === viewer.me) {
    return `Waiting for ${nameOf(viewer.other) ?? "an answer"}`;
  }
  return `${nameOf(proposal.proposed_by) ?? "Proposed"}: ${to === "Me" ? "for you" : to === "Both" ? "for both of you" : `for ${to}`}`;
}

/** Accept / Decline buttons for a proposal made to me. */
export function AnswerButtons({ proposal, actions }: { proposal: Proposal; actions: Actions }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => actions.answer(proposal, true)} className={`${ui.primary} min-h-9 px-4 text-sm`}>
        Accept
      </button>
      <button type="button" onClick={() => actions.answer(proposal, false)} className={`${ui.secondary} min-h-9 px-4 text-sm`}>
        Decline
      </button>
    </div>
  );
}

type RowProps = {
  occ: Occurrence;
  agenda: Agenda;
  viewer: Viewer;
  nameOf: NameOf;
  actions: Actions;
  onOpen: (occ: Occurrence) => void;
  /** Grouped by day: show the time on that day. Otherwise the date and time are shown. */
  day?: string;
  overdue?: boolean;
};

/** One event or task in a list: time, title, assignee, tick box and proposal state. */
export function ItemRow({ occ, agenda, viewer, nameOf, actions, onOpen, day, overdue }: RowProps) {
  const item = occ.item;
  const isTask = item.kind === "task";
  const main = owner(occ);
  const pending = pendingProposal(agenda.proposals, main.id);
  const declined = unseenDecline(agenda.proposals, main.id, viewer.me);
  const toMe = pending && pending.proposed_by !== viewer.me;
  const when = day ? timeLabel(occ, day, viewer.timeZone) : whenLabel(occ, viewer.today, viewer.timeZone);

  return (
    <li className={`border-b border-line last:border-b-0 ${toMe ? "bg-accent/15" : ""}`}>
      <div className="flex min-h-12 items-start gap-3 px-4 py-2.5">
        {isTask ? (
          <TaskTick done={occ.done} label={item.title} onToggle={() => actions.toggleDone(occ)} />
        ) : (
          <span aria-hidden className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-accent" />
        )}
        <button type="button" onClick={() => onOpen(occ)} className="flex min-w-0 flex-1 flex-col text-left active:opacity-70">
          <span className={`truncate ${occ.done ? "text-muted line-through" : "font-medium text-ink"}`}>{item.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            {when && <span className={overdue ? "font-semibold text-danger" : ""}>{when}</span>}
            {overdue && <span className="font-semibold text-danger">overdue</span>}
            {occ.series && <span aria-label="Repeats">↻</span>}
            {pending && <span className="font-semibold text-accent">{proposalText(pending, viewer, nameOf)}</span>}
            {declined && <span className="font-semibold text-danger">{nameOf(declined.answered_by) ?? "They"} declined</span>}
          </span>
        </button>
        <span className="mt-0.5 shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-muted">
          {assigneeLabel(main.assignees, viewer.me, (id) => nameOf(id))}
        </span>
      </div>
      {toMe && (
        <div className="px-4 pb-3 pl-12">
          <AnswerButtons proposal={pending} actions={actions} />
        </div>
      )}
      {declined && (
        <div className="px-4 pb-3 pl-12">
          <button type="button" onClick={() => actions.acknowledge(declined)} className="text-sm font-semibold text-brand underline">
            OK, got it
          </button>
        </div>
      )}
    </li>
  );
}

/** A list of rows in a card. */
export function ItemList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">{children}</ul>;
}
