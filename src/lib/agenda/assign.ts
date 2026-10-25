/** Assigning items: what takes effect straight away and what needs an answer. */

export type Assignee = "unassigned" | "me" | "other" | "both";

export const sameAssignees = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The user ids for a choice in the form. */
export function assigneeIds(choice: Assignee, me: string, other: string | null): string[] {
  switch (choice) {
    case "unassigned":
      return [];
    case "me":
      return [me];
    case "other":
      return other ? [other] : [];
    case "both":
      return other ? [me, other] : [me];
  }
}

/** The form's choice for an assignment. */
export function assigneeChoice(assignees: string[], me: string): Assignee {
  if (assignees.length === 0) return "unassigned";
  const hasMe = assignees.includes(me);
  if (hasMe && assignees.length > 1) return "both";
  return hasMe ? "me" : "other";
}

export type AssignmentPlan =
  /** Nothing changes. */
  | { kind: "none" }
  /** Set straight away (and withdraw any pending proposal). */
  | { kind: "direct"; assignees: string[] }
  /** Needs the other person's answer; the item keeps its current assignment meanwhile. */
  | { kind: "propose"; assignees: string[] };

/**
 * Anything that adds the other person needs their answer. Everything else,
 * including removing them, takes effect straight away.
 */
export function planAssignment(current: string[], next: string[], me: string, pending: string[] | null = null): AssignmentPlan {
  const target = [...new Set(next)];
  if (pending && sameAssignees(pending, target)) return { kind: "none" };
  const addsOther = target.some((id) => id !== me && !current.includes(id));
  if (addsOther) return { kind: "propose", assignees: target };
  if (sameAssignees(current, target) && !pending) return { kind: "none" };
  return { kind: "direct", assignees: target };
}

/** "Me", "Kat", "Both", "Unassigned", as shown on an item. */
export function assigneeLabel(assignees: string[], me: string, nameOf: (id: string) => string | null): string {
  switch (assigneeChoice(assignees, me)) {
    case "unassigned":
      return "Unassigned";
    case "me":
      return "Me";
    case "both":
      return "Both";
    case "other":
      return nameOf(assignees[0]) ?? "Other";
  }
}
