export const ITEM_KINDS = ["event", "task"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type TaskStatus = "open" | "done";

/** A row of agenda_items: an event, a task, or a changed occurrence of a series. */
export type AgendaItem = {
  id: string;
  kind: ItemKind;
  title: string;
  note: string | null;
  all_day: boolean;
  /** Timed items: UTC instants. */
  starts_at: string | null;
  ends_at: string | null;
  /** All-day items: YYYY-MM-DD, end inclusive (null means one day). */
  start_date: string | null;
  end_date: string | null;
  time_zone: string;
  /** Google-style recurrence lines, e.g. ["RRULE:FREQ=WEEKLY;BYDAY=TU"]. */
  recurrence: string[] | null;
  keep_missed: boolean;
  recurring_item_id: string | null;
  /** The occurrence's original start (see occurrenceKey). */
  original_start: string | null;
  cancelled: boolean;
  assignees: string[];
  task_status: TaskStatus | null;
  done_at: string | null;
  done_by: string | null;
  reminder_minutes: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalStatus = "pending" | "accepted" | "declined";

export type Proposal = {
  id: string;
  item_id: string;
  proposed_by: string;
  proposed_assignees: string[];
  status: ProposalStatus;
  answered_by: string | null;
  answered_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export type AgendaSettings = {
  user_id: string;
  nudge_enabled: boolean;
  /** 0 = Sunday … 6 = Saturday. */
  nudge_weekday: number;
  nudge_dismissed_on: string | null;
};

export const DEFAULT_SETTINGS: Omit<AgendaSettings, "user_id"> = {
  nudge_enabled: true,
  nudge_weekday: 0,
  nudge_dismissed_on: null,
};

/** Everything in Agenda, loaded in one go (it's small). */
export type Agenda = {
  items: AgendaItem[];
  proposals: Proposal[];
};

export const EMPTY_AGENDA: Agenda = { items: [], proposals: [] };
