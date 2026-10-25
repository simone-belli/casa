"use client";

import { useState } from "react";
import { ui } from "@/components/ui";
import { planAssignment, type Assignee } from "@/lib/agenda/assign";
import { applyAssignment, cancelOccurrence, createItem, deleteItem, saveOccurrence, saveSeries, updateItem } from "@/lib/agenda/db";
import {
  draftAssignees,
  draftFromOccurrence,
  draftProblem,
  fieldsFromDraft,
  seriesFieldsFromOccurrenceDraft,
  withKind,
  type Draft,
} from "@/lib/agenda/draft";
import { reminderLabel, reminderParts, UNIT_MINUTES, type ReminderUnit } from "@/lib/agenda/format";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { describeRecurrence, NO_REPEAT, ordinal, type RepeatChoice } from "@/lib/agenda/recurrence";
import { addDays, dateParts, daysBetween, weekday } from "@/lib/agenda/time";
import type { Agenda, AgendaItem } from "@/lib/agenda/types";
import type { useAgenda } from "@/lib/agenda/use-agenda";
import { owner, pendingProposal, unseenDecline, type Viewer } from "@/lib/agenda/views";
import { uid } from "@/lib/uid";
import { AnswerButtons, proposalText, useAgendaActions } from "./parts";

type Props = {
  /** A new item from a draft, or an existing occurrence. */
  target: { draft: Draft } | { occ: Occurrence };
  agenda: Agenda;
  viewer: Viewer;
  nameOf: (id: string | null | undefined) => string | null;
  change: ReturnType<typeof useAgenda>["change"];
  onClose: () => void;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ORDINAL = ["", "first", "second", "third", "fourth"];

type RepeatOption = { value: string; label: string; choice: RepeatChoice };

/** The repeat options, worded for the start date. */
function repeatOptions(date: string): RepeatOption[] {
  const day = dateParts(date).day;
  const name = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  const { year, month } = dateParts(date);
  const isLast = day + 7 > new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nth = isLast ? "last" : ORDINAL[Math.ceil(day / 7)];
  const c = (fields: Partial<RepeatChoice>): RepeatChoice => ({ ...NO_REPEAT, ...fields });
  return [
    { value: "none", label: "Doesn't repeat", choice: NO_REPEAT },
    { value: "daily", label: "Every day", choice: c({ freq: "daily" }) },
    { value: "weekly", label: "Every week", choice: c({ freq: "weekly" }) },
    { value: "weekly2", label: "Every 2 weeks", choice: c({ freq: "weekly", interval: 2 }) },
    { value: "monthly", label: `Every month on the ${ordinal(day)}`, choice: c({ freq: "monthly" }) },
    { value: "monthlyWeekday", label: `Every month on the ${nth} ${name}`, choice: c({ freq: "monthly", monthlyBy: "weekday" }) },
    { value: "yearly", label: "Every year", choice: c({ freq: "yearly" }) },
  ];
}

function repeatValue(repeat: RepeatChoice | "custom"): string {
  if (repeat === "custom") return "custom";
  if (repeat.freq === "weekly") return repeat.interval === 2 ? "weekly2" : "weekly";
  if (repeat.freq === "monthly") return repeat.monthlyBy === "weekday" ? "monthlyWeekday" : "monthly";
  return repeat.freq;
}

const REMINDER_PRESETS = [null, 0, 10, 30, 60, 1440];

/** Add or edit an event or task. */
export function ItemSheet({ target, agenda, viewer, nameOf, change, onClose }: Props) {
  const occ = "occ" in target ? target.occ : null;
  const main = occ ? owner(occ) : null;
  const series = occ?.series ?? null;
  const [initial] = useState<Draft>(() => (occ ? draftFromOccurrence(occ, viewer.timeZone, viewer.me) : (target as { draft: Draft }).draft));
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [askScope, setAskScope] = useState<"save" | "delete" | null>(null);
  const [customReminder, setCustomReminder] = useState(() => draft.reminder !== null && !REMINDER_PRESETS.includes(draft.reminder));
  const actions = useAgendaActions(change);

  const pending = main ? pendingProposal(agenda.proposals, main.id) : null;
  const declined = main ? unseenDecline(agenda.proposals, main.id, viewer.me) : null;
  const otherName = nameOf(viewer.other) ?? "Them";
  const problem = draftProblem(draft);
  const assignees = draftAssignees(draft, viewer.me, viewer.other);
  const plan = planAssignment(main?.assignees ?? [], assignees, viewer.me, pending?.proposed_assignees ?? null);

  const set = (fields: Partial<Draft>) => setDraft((d) => ({ ...d, ...fields }));

  const setDate = (date: string) => {
    if (!date) return;
    set({ date, endDate: addDays(date, Math.max(0, daysBetween(draft.date, draft.endDate))) });
  };

  // The assignment is saved on its own, so it doesn't count as a change to the details.
  const details = (d: Draft) => JSON.stringify({ ...d, assignee: null });
  const detailsChanged = details(draft) !== details(initial);
  const repeatChanged = JSON.stringify(draft.repeat) !== JSON.stringify(initial.repeat);

  async function finish(save: () => Promise<void>) {
    setSaving(true);
    const saved = await change(null, async () => {
      await save();
    });
    setSaving(false);
    if (saved) onClose();
  }

  async function saveNew() {
    const id = uid();
    const fields = fieldsFromDraft(draft, viewer.timeZone);
    const direct = plan.kind === "direct" ? plan.assignees : [];
    const now = new Date().toISOString();
    const row: AgendaItem = {
      ...fields,
      id,
      assignees: direct,
      recurring_item_id: null,
      original_start: null,
      cancelled: false,
      task_status: fields.kind === "task" ? "open" : null,
      done_at: null,
      done_by: null,
      created_by: viewer.me,
      updated_by: viewer.me,
      created_at: now,
      updated_at: now,
    };
    setSaving(true);
    const saved = await change(
      (d) => ({ ...d, items: [...d.items, row] }),
      async () => {
        await createItem(id, fields, direct);
        if (plan.kind === "propose") await applyAssignment(id, plan);
      },
    );
    setSaving(false);
    if (saved) onClose();
  }

  function save(scope?: "one" | "all") {
    if (problem) return;
    if (!occ) return void saveNew();
    const item = occ.item;
    if (series && detailsChanged && !repeatChanged && !scope) return setAskScope("save");
    void finish(async () => {
      if (detailsChanged) {
        if (series && scope === "one") await saveOccurrence(occ, fieldsFromDraft(draft, viewer.timeZone, series));
        else if (series) await saveSeries(series, seriesFieldsFromOccurrenceDraft(draft, occ, series, viewer.timeZone), viewer.today);
        else await updateItem(item.id, fieldsFromDraft(draft, viewer.timeZone, item));
      }
      await applyAssignment(main!.id, plan);
    });
  }

  function remove(scope?: "one" | "all") {
    if (!occ) return;
    if (series && !scope) return setAskScope("delete");
    if (!series && !window.confirm(`Delete “${occ.item.title}”?`)) return;
    onClose();
    void change(
      (d) => ({
        ...d,
        items:
          series && scope === "one"
            ? d.items.filter((i) => i.id !== occ.exception?.id)
            : d.items.filter((i) => i.id !== main!.id && i.recurring_item_id !== main!.id),
      }),
      () => (series && scope === "one" ? cancelOccurrence(occ) : deleteItem(main!.id)),
    );
  }

  const repeatOpts = repeatOptions(draft.date);
  const isTask = draft.kind === "task";
  const reminderUnit = draft.reminder !== null ? reminderParts(draft.reminder) : { amount: 1, unit: "hour" as ReminderUnit };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={occ ? `Edit ${occ.item.title}` : "Add to the agenda"}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-xl"
      >
        {pending && (
          <div className="flex flex-col gap-2 rounded-2xl bg-accent/15 p-3">
            <p className="font-semibold">{proposalText(pending, viewer, nameOf)}</p>
            {pending.proposed_by !== viewer.me ? (
              <AnswerButtons proposal={pending} actions={actions} />
            ) : (
              <p className="text-sm text-muted">
                It stays as it is until {otherName} answers. Change the assignee below to withdraw it.
              </p>
            )}
          </div>
        )}
        {declined && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 p-3">
            <p className="text-danger">{nameOf(declined.answered_by) ?? otherName} declined. It&apos;s back with you.</p>
            <button type="button" onClick={() => actions.acknowledge(declined)} className="shrink-0 text-sm font-semibold text-brand underline">
              OK
            </button>
          </div>
        )}

        <div className="flex rounded-full border border-line bg-bg p-0.5 font-semibold" role="group" aria-label="Type">
          {(["event", "task"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={draft.kind === kind}
              onClick={() => setDraft((d) => withKind(d, kind))}
              className={`flex-1 rounded-full py-2 ${draft.kind === kind ? "bg-brand text-brand-ink" : "text-muted"}`}
            >
              {kind === "event" ? "Event" : "Task"}
            </button>
          ))}
        </div>

        <label>
          <span className={ui.label}>Title</span>
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            autoFocus={!occ && !draft.title}
            placeholder={isTask ? "e.g. Book the boiler service" : "e.g. Marco's birthday party"}
            className={ui.input}
          />
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className={ui.label}>When</legend>
          {isTask && (
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={draft.dated} onChange={(e) => set({ dated: e.target.checked })} className="h-5 w-5 accent-brand" />
              <span>Has a date</span>
            </label>
          )}
          {draft.dated && (
            <>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={draft.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="h-5 w-5 accent-brand" />
                <span>All day</span>
              </label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="sr-only">Date</span>
                  <input type="date" value={draft.date} onChange={(e) => setDate(e.target.value)} className={ui.input} />
                </label>
                {!draft.allDay && (
                  <label className="w-32">
                    <span className="sr-only">Start time</span>
                    <input type="time" value={draft.startTime} onChange={(e) => e.target.value && set({ startTime: e.target.value })} className={ui.input} />
                  </label>
                )}
              </div>
              {(!isTask || !draft.allDay) && (
                <div className="flex items-center gap-2">
                  <span className="w-10 shrink-0 text-sm text-muted">{draft.allDay ? "Until" : "Ends"}</span>
                  <label className="flex-1">
                    <span className="sr-only">End date</span>
                    <input
                      type="date"
                      value={draft.endDate}
                      min={draft.date}
                      onChange={(e) => e.target.value && set({ endDate: e.target.value })}
                      className={ui.input}
                    />
                  </label>
                  {!draft.allDay && (
                    <label className="w-32">
                      <span className="sr-only">End time</span>
                      <input type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} className={ui.input} />
                    </label>
                  )}
                </div>
              )}
              {isTask && !draft.allDay && !draft.endTime && <p className="-mt-1 text-sm text-muted">No end time (optional for tasks).</p>}

              <label>
                <span className="sr-only">Repeat</span>
                <select
                  value={repeatValue(draft.repeat)}
                  onChange={(e) => {
                    const picked = repeatOpts.find((o) => o.value === e.target.value);
                    if (picked) set({ repeat: { ...picked.choice, until: draft.repeat === "custom" ? null : draft.repeat.until } });
                  }}
                  className={ui.input}
                >
                  {draft.repeat === "custom" && (
                    <option value="custom">{describeRecurrence(series?.recurrence ?? null, draft.date) ?? "Custom"}</option>
                  )}
                  {repeatOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {draft.repeat !== "custom" && draft.repeat.freq === "weekly" && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="On">
                  {WEEK_ORDER.map((d) => {
                    const repeat = draft.repeat as RepeatChoice;
                    const days = repeat.weekdays.length > 0 ? repeat.weekdays : [weekday(draft.date)];
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = on ? days.filter((x) => x !== d) : [...days, d];
                          if (next.length > 0) set({ repeat: { ...repeat, weekdays: next } });
                        }}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink"}`}
                      >
                        {WEEKDAY_SHORT[d]}
                      </button>
                    );
                  })}
                </div>
              )}
              {draft.repeat !== "custom" && draft.repeat.freq !== "none" && (
                <label className="flex items-center gap-2">
                  <span className="shrink-0 text-sm text-muted">Until</span>
                  <input
                    type="date"
                    value={draft.repeat.until ?? ""}
                    min={draft.date}
                    onChange={(e) => set({ repeat: { ...(draft.repeat as RepeatChoice), until: e.target.value || null } })}
                    className={ui.input}
                  />
                </label>
              )}
              {isTask && (draft.repeat === "custom" || draft.repeat.freq !== "none") && (
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={draft.keepMissed} onChange={(e) => set({ keepMissed: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand" />
                  <span>
                    Keep missed occurrences
                    <span className="block text-sm text-muted">Ones not ticked off stay listed as overdue. Otherwise they&apos;re skipped.</span>
                  </span>
                </label>
              )}

              <div className="flex flex-col gap-2">
                <label>
                  <span className="sr-only">Reminder</span>
                  <select
                    value={customReminder ? "custom" : String(draft.reminder)}
                    onChange={(e) => {
                      if (e.target.value === "custom") {
                        setCustomReminder(true);
                        set({ reminder: draft.reminder ?? 60 });
                      } else {
                        setCustomReminder(false);
                        set({ reminder: e.target.value === "null" ? null : Number(e.target.value) });
                      }
                    }}
                    className={ui.input}
                  >
                    {REMINDER_PRESETS.map((m) => (
                      <option key={String(m)} value={String(m)}>
                        {m === null ? "No reminder" : `Reminder: ${reminderLabel(m).toLowerCase()}`}
                      </option>
                    ))}
                    <option value="custom">Reminder: other…</option>
                  </select>
                </label>
                {customReminder && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      value={reminderUnit.amount}
                      onChange={(e) => {
                        const amount = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                        set({ reminder: amount * UNIT_MINUTES[reminderUnit.unit] });
                      }}
                      className={`${ui.input} w-20`}
                      aria-label="How many"
                    />
                    <select
                      value={reminderUnit.unit}
                      onChange={(e) => set({ reminder: reminderUnit.amount * UNIT_MINUTES[e.target.value as ReminderUnit] })}
                      className={`${ui.input} w-auto`}
                      aria-label="Unit"
                    >
                      <option value="minute">minutes</option>
                      <option value="hour">hours</option>
                      <option value="day">days</option>
                    </select>
                    <span className="text-muted">before</span>
                  </div>
                )}
                <p className="text-sm text-muted">Reminders come from Google Calendar.</p>
              </div>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend className={ui.label}>For</legend>
          <div className="flex rounded-full border border-line bg-bg p-0.5 text-sm font-semibold" role="group">
            {(
              [
                ["unassigned", "Unassigned"],
                ["me", "Me"],
                ["other", otherName],
                ["both", "Both"],
              ] as [Assignee, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={draft.assignee === value}
                disabled={!viewer.other && (value === "other" || value === "both")}
                onClick={() => set({ assignee: value })}
                className={`min-w-0 flex-1 truncate rounded-full px-1 py-2 ${draft.assignee === value ? "bg-brand text-brand-ink" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {plan.kind === "propose" && <p className="mt-1.5 text-sm text-muted">{otherName} will be asked to accept.</p>}
          {series && <p className="mt-1.5 text-sm text-muted">The assignment applies to every occurrence.</p>}
        </fieldset>

        <label>
          <span className={ui.label}>Note</span>
          <textarea value={draft.note} onChange={(e) => set({ note: e.target.value })} rows={2} className={ui.input} />
        </label>

        {problem && draft.title.trim() && <p className={ui.error}>{problem}</p>}

        {askScope ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
            <p className="font-semibold">{askScope === "save" ? "Change which ones?" : "Delete which ones?"}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => (askScope === "save" ? save("one") : remove("one"))}
                className={`${askScope === "delete" ? ui.danger : ui.primary} flex-1`}
              >
                This one
              </button>
              <button
                type="button"
                onClick={() => (askScope === "save" ? save("all") : remove("all"))}
                className={`${askScope === "delete" ? ui.danger : ui.primary} flex-1`}
              >
                All of them
              </button>
              <button type="button" onClick={() => setAskScope(null)} className={ui.secondary}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => save()} disabled={saving || Boolean(problem)} className={`${ui.primary} flex-1`}>
                {saving ? "Saving…" : occ ? "Save" : "Add"}
              </button>
              <button type="button" onClick={onClose} className={ui.secondary}>
                Cancel
              </button>
            </div>
            {occ && occ.item.kind === "task" && (
              <button
                type="button"
                onClick={() => {
                  actions.toggleDone(occ);
                  onClose();
                }}
                className={ui.secondary}
              >
                {occ.done ? "Reopen" : "Tick off"}
              </button>
            )}
            {occ && (
              <button type="button" onClick={() => remove()} className={ui.danger}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
