"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { uid } from "@/lib/uid";
import type { AssignmentPlan } from "./assign";
import type { ItemFields } from "./draft";
import type { Occurrence } from "./occurrences";
import { DEFAULT_SETTINGS, type Agenda, type AgendaItem, type AgendaSettings, type Proposal } from "./types";

function check(error: { message: string } | null): void {
  if (error) throw error;
}

export async function loadAgenda(): Promise<Agenda> {
  const db = supabaseBrowser();
  const [items, proposals] = await Promise.all([
    db.from("agenda_items").select("*"),
    db.from("agenda_proposals").select("*"),
  ]);
  check(items.error);
  check(proposals.error);
  return { items: items.data as AgendaItem[], proposals: proposals.data as Proposal[] };
}

/** Calls `onChange` whenever an item or proposal changes, by either person or from Google. */
export function watchAgenda(onChange: () => void): () => void {
  const supabase = supabaseBrowser();
  const channel = supabase
    .channel(`agenda:${uid()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "agenda_items" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "agenda_proposals" }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// --- Items ------------------------------------------------------------------

export async function createItem(id: string, fields: ItemFields, assignees: string[]): Promise<void> {
  check((await supabaseBrowser().from("agenda_items").insert({ id, ...fields, assignees })).error);
}

export async function updateItem(id: string, fields: Partial<AgendaItem>): Promise<void> {
  check((await supabaseBrowser().from("agenda_items").update(fields).eq("id", id)).error);
}

export async function deleteItem(id: string): Promise<void> {
  check((await supabaseBrowser().from("agenda_items").delete().eq("id", id)).error);
}

/** Fields a changed occurrence copies from its series, besides its own dates. */
const COPIED = ["kind", "title", "note", "time_zone", "reminder_minutes", "assignees"] as const;

/** A new row for one occurrence of a series, as the series has it. */
export function occurrenceRow(occ: Occurrence, series: AgendaItem): Partial<AgendaItem> {
  const copied = Object.fromEntries(COPIED.map((k) => [k, series[k]]));
  return {
    ...copied,
    recurring_item_id: series.id,
    original_start: occ.occurrence,
    all_day: occ.allDay,
    start_date: occ.allDay ? occ.date : null,
    end_date: occ.allDay && occ.endDate !== occ.date ? occ.endDate : null,
    starts_at: occ.allDay ? null : occ.startsAt,
    ends_at: occ.allDay ? null : occ.endsAt,
  };
}

/** Changes one occurrence of a series, creating its own row if it has none yet. */
async function changeOccurrence(occ: Occurrence, fields: Partial<AgendaItem>): Promise<void> {
  const db = supabaseBrowser();
  if (occ.exception) {
    check((await db.from("agenda_items").update(fields).eq("id", occ.exception.id)).error);
    return;
  }
  const series = occ.series!;
  const { error } = await db.from("agenda_items").insert({ id: uid(), ...occurrenceRow(occ, series), ...fields });
  if (error && "code" in error && error.code === "23505") {
    // The other phone created it a moment ago.
    check(
      (await db.from("agenda_items").update(fields).eq("recurring_item_id", series.id).eq("original_start", occ.occurrence!)).error,
    );
    return;
  }
  check(error);
}

/** Ticks a task (or one occurrence of a recurring task) off, or reopens it. */
export async function setDone(occ: Occurrence, done: boolean): Promise<void> {
  const task_status = done ? "done" : "open";
  if (occ.series) await changeOccurrence(occ, { task_status });
  else await updateItem(occ.item.id, { task_status });
}

/** "This one": saves the form's fields on a single occurrence of a series. */
export async function saveOccurrence(occ: Occurrence, fields: ItemFields): Promise<void> {
  // The occurrence's assignment stays the series'; it can't repeat on its own.
  await changeOccurrence(occ, { ...fields, recurrence: null, keep_missed: false });
}

/** "This one": deletes one occurrence of a series. */
export async function cancelOccurrence(occ: Occurrence): Promise<void> {
  await changeOccurrence(occ, { cancelled: true });
}

const SCHEDULE = ["all_day", "starts_at", "ends_at", "start_date", "end_date", "time_zone", "recurrence"] as const;

/**
 * "All of them": saves the series. Changes to the title, note and reminder
 * also reach the changed occurrences that still had the old value. If the
 * schedule changed, changed occurrences that are still to come or not
 * ticked off are dropped, since they belonged to the old dates.
 */
export async function saveSeries(series: AgendaItem, fields: ItemFields, today: string): Promise<void> {
  const db = supabaseBrowser();
  check((await db.from("agenda_items").update(fields).eq("id", series.id)).error);

  if (!fields.recurrence) {
    // No longer a series: its occurrences' own rows go.
    check((await db.from("agenda_items").delete().eq("recurring_item_id", series.id)).error);
    return;
  }
  if (SCHEDULE.some((k) => JSON.stringify(series[k]) !== JSON.stringify(fields[k]))) {
    check(
      (
        await db
          .from("agenda_items")
          .delete()
          .eq("recurring_item_id", series.id)
          .or(`task_status.is.null,task_status.eq.open,original_start.gte.${today}`)
      ).error,
    );
  }
  if (series.kind !== fields.kind) {
    check((await db.from("agenda_items").update({ kind: fields.kind }).eq("recurring_item_id", series.id)).error);
  }
  for (const key of ["title", "note", "reminder_minutes"] as const) {
    if (series[key] === fields[key]) continue;
    const query = db.from("agenda_items").update({ [key]: fields[key] }).eq("recurring_item_id", series.id);
    check((await (series[key] === null ? query.is(key, null) : query.eq(key, series[key]))).error);
  }
}

// --- Assigning ----------------------------------------------------------------

/** Carries out an assignment plan for an item (the series, for a recurring one). */
export async function applyAssignment(itemId: string, plan: AssignmentPlan): Promise<void> {
  if (plan.kind === "none") return;
  const db = supabaseBrowser();
  // Any pending proposal is replaced or withdrawn.
  check((await db.from("agenda_proposals").delete().eq("item_id", itemId).eq("status", "pending")).error);
  if (plan.kind === "propose") {
    check((await db.from("agenda_proposals").insert({ item_id: itemId, proposed_assignees: plan.assignees })).error);
    return;
  }
  check((await db.from("agenda_items").update({ assignees: plan.assignees }).eq("id", itemId)).error);
  check((await db.from("agenda_items").update({ assignees: plan.assignees }).eq("recurring_item_id", itemId)).error);
}

export async function answerProposal(proposalId: string, accept: boolean): Promise<void> {
  const { error } = await supabaseBrowser().rpc("agenda_answer_proposal", { proposal_id: proposalId, accept });
  check(error);
}

/** The proposer has seen that their proposal was declined. */
export async function acknowledgeDecline(proposalId: string): Promise<void> {
  check(
    (await supabaseBrowser().from("agenda_proposals").update({ acknowledged_at: new Date().toISOString() }).eq("id", proposalId)).error,
  );
}

// --- Settings --------------------------------------------------------------------

export async function loadMySettings(me: string): Promise<AgendaSettings> {
  const { data, error } = await supabaseBrowser().from("agenda_settings").select("*").eq("user_id", me).maybeSingle();
  check(error);
  return (data as AgendaSettings | null) ?? { user_id: me, ...DEFAULT_SETTINGS };
}

export async function saveMySettings(settings: AgendaSettings): Promise<void> {
  check((await supabaseBrowser().from("agenda_settings").upsert(settings, { onConflict: "user_id" })).error);
}
