# Agenda — Spec v0.2

_v0.2 resolves the open questions from v0.1: where assigned undated tasks go, missed occurrences of recurring tasks, overdue tasks, removing someone from an item, and Google sync now that Casa is deployed on Vercel over HTTPS. v0.1 replaced the Agenda notes captured in [CASA-SPEC.md](CASA-SPEC.md) and moved calendar sync from Apple Calendar to Google Calendar._

## Purpose

A shared calendar and task manager for Simone and Kat. Events (e.g. "Marco's birthday party, Saturday 19:00") and tasks (e.g. "Book the boiler service") live in one place. Anything dated also appears in a shared Google Calendar, so it shows up in the calendar apps we already use. Tasks can stay undated and unassigned until someone picks them up. Either of us can propose a task or event to the other, who accepts or declines it.

## Users and platform

Same as the rest of Casa: two users, shared data, live updates, mobile-first, interface in English.

## Concepts

- **Item**: an event or a task.
  - **Event**: something that happens at a time. It always has a date, either all-day or with a start and end time. It can be recurring.
  - **Task**: something to get done. Its date is optional. A dated task can be all-day or have a time, and can be recurring. A task can be open or done.
- **Recurring task**: a dated task that repeats, e.g. "Take the bins out, every Tuesday". Each occurrence is ticked off on its own, and ticking one doesn't affect the next. A task needs a date to be recurring.
  - **Keep missed occurrences**: an option on each recurring task, **off** by default. When it's off, an occurrence that passes without being ticked off is simply skipped, and only the next one is shown. When it's on, missed occurrences stay listed as overdue until they're ticked off.
- **Overdue**: an open task whose day has passed (a task due today stays under today, even after its time). One-off tasks are always kept as overdue until they're done or moved to a new date. Events are never overdue.
- **Assignee**: who an item is for. It can be **unassigned**, **Simone**, **Kat** or **both**. Events and tasks are assigned the same way.
- **Proposal**: an assignment that's waiting for the other person's answer (see below).
- **Casa calendar**: the one shared Google Calendar that Agenda syncs with.

## Assigning and proposing

- **Assigning yourself** takes effect straight away.
- **Assigning the other person, or both of you**, makes a proposal. The item shows as **proposed** until the other person answers:
  - **Accept**: the assignment takes effect.
  - **Decline**: the item goes back to the person who proposed it, assigned to them alone. They can see it was declined and can reassign it, propose again or delete it.
- An unassigned item can be picked up by either of us: assigning yourself needs no answer.
- A proposed event is still on the calendar while it waits for an answer. Only the assignment is pending.
- Changing an assignment works the same way: anything that adds the other person needs their answer. Everything else takes effect straight away, including removing the other person (e.g. changing a task from Kat to unassigned, or from Kat to Simone).
- While a proposal is waiting, the item keeps its previous assignment.

## Task lifecycle

**Open** (possibly unassigned and undated) → **proposed** → **accepted** or **declined** → **done**. Done tasks can be reopened.

## Views

### Calendar

- Every dated item, events and tasks, in a day-by-day list starting from today. A month grid gives an overview and jumps to a day.
- An **Overdue** group at the top lists overdue tasks (see Concepts), until they're ticked off or moved to a new date.
- Each item shows its time, title and assignee. Tasks have a tick box, and proposed items are marked as such.
- Filter: **Everyone** / **Mine** (assigned to me or to both of us).
- Items created directly in Google Calendar appear here too.

### Tasks

Every task, dated or not, in sections from top to bottom:

1. **Waiting for your answer**: proposals made to me.
2. **Undecided**: open tasks that are unassigned, dated or not.
3. **Mine**, **Kat's** / **Simone's**, **Both of us**: open assigned tasks by assignee, with dated ones in date order first, then undated ones.
4. **Done**: collapsed, most recent first.

Proposals I've made that are still waiting show a "waiting for Kat" (or "waiting for Simone") label where they sit (by the item's current assignment). Overdue tasks show an "overdue" label. A recurring task shows its next open occurrence, plus any missed ones if it keeps missed occurrences.

## Adding and editing

- **Quick add**, from both views: type or dictate a line like "Marco's birthday party Saturday 7pm" or "book boiler service". Claude fills in the type, title, date, time and assignee if they're mentioned. The filled-in form is shown for checking before anything is saved. Anything not mentioned stays empty: a task with no date or assignee is fine.
- **Form**: type (event / task), title, note, all-day or start and end time (end optional for tasks), recurrence (needs a date), keep missed occurrences (recurring tasks only), assignee, reminder.
- **Editing a recurring item** asks **This one** or **All of them**.
- Deleting asks for confirmation. Deleting a synced item also deletes it from Google Calendar.

## Google Calendar sync

- **One shared calendar.** We create a calendar called "Casa" in one Google account and share it with the other person with permission to make changes, so it appears in both our calendar apps. Agenda syncs with that calendar only. Our personal and work calendars aren't touched or read.
- **Connecting.** Settings → Agenda → **Connect Google Calendar**: sign in with the Google account that owns the Casa calendar and pick it from the list. This is done once. The access token is stored on the server only, encrypted, and never sent to the phones. Disconnecting stops syncing without deleting anything on either side.
- **Agenda → Google.** Every dated item (event or task) is written to the Casa calendar, and changes and deletions follow. Undated tasks aren't written. When a task gets a date it's added, and when it loses its date it's removed. In Google:
  - The title is the item's title. Tasks get a "☐ " prefix, which becomes "☑ " when done, so they're recognisable in the calendar app.
  - The description holds the note and an "Assigned: Kat" (or "Simone", "Both", "Unassigned", "Proposed to Kat") line.
  - Agenda's own item ID is stored in the event's hidden properties, so the two stay matched even if the title changes.
- **Google → Agenda.** New events on the Casa calendar come in as events assigned to both of us. Changing a task's "☐" to "☑" in Google ticks it off in Agenda. Edits (title, time, recurrence, description) and deletions made in Google come back into Agenda. Agenda strips the "☐"/"☑" prefix and its own "Assigned:" line when reading, so they don't pile up.
- **Timing: instant in both directions.** Changes made in Agenda are written to Google as soon as they're saved. For changes made in Google, Agenda subscribes to Google's change notifications for the Casa calendar. Google calls Casa's public HTTPS address on Vercel whenever the calendar changes, and Agenda fetches just what changed. The subscription expires after a while (about a week), so a daily scheduled job on Vercel renews it before it does. As a safety net, Agenda also checks for changes whenever someone opens it, in case a notification was missed.
- **Conflicts.** If the same item is changed on both sides at almost the same moment, the most recent change wins.
- **Recurring items** (events and tasks) use Google's recurrence rules, so they behave the same on both sides. A single changed or deleted occurrence of a series is kept as an exception, as Google does. Ticking off one occurrence of a recurring task changes only that occurrence in Google ("☑").

## Reminders

- Any dated item can have a reminder: at the time, or a chosen number of minutes, hours or days before.
- In v0 reminders are delivered by Google Calendar. Agenda sets them on the synced event, and each of us gets the notification from our calendar app.
- Undated tasks can't have a reminder in v0. Agenda's own notifications (needed for reminders on undated tasks, and for proposals) are the next step after v0. Casa is now served over HTTPS, so nothing blocks them any more; they're just not in this build.

## Nudge about undecided tasks

- An optional periodic nudge listing tasks that are still **undecided** or have proposals **waiting for an answer**.
- In v0 it's a banner at the top of Agenda, shown on the chosen day until dismissed. Once Agenda sends its own notifications, it becomes one.
- Settings → Agenda (per person): nudge on/off and day of the week. Default: on, Sunday.

## Data model

- `agenda_items`: id, kind (`event` / `task`), title, note, all_day, starts_at, ends_at, start_date / end_date (for all-day items), time_zone, recurrence (Google-style rule, dated items only), keep_missed (recurring tasks only, default false), recurring_item_id and original_start (for a changed or ticked-off occurrence of a series), assignees (none, one or both user ids), task_status (`open` / `done`), done_at, done_by, reminder_minutes, created by / updated by, timestamps
- `agenda_proposals`: id, item id, proposed_by, proposed_assignees, status (`pending` / `accepted` / `declined`), answered_by, answered_at, created_at. An item has at most one pending proposal.
- `agenda_google_links`: item id, Google event id, Google etag, last synced at
- `agenda_sync_state` (server only, not readable by the phones): Google account, calendar id, encrypted refresh token, incremental sync token, last sync time, change-notification channel id and expiry
- `agenda_settings`: user id, nudge_enabled, nudge_weekday

`agenda_items`, `agenda_proposals` and `agenda_settings` have the same Row Level Security as the rest of Casa. Realtime is turned on for `agenda_items` and `agenda_proposals`, so both phones update live. `agenda_sync_state` is only used by the server.

## Out of scope for v1

- Syncing with more than the one Casa calendar, or reading our personal or work calendars (e.g. to spot clashes)
- Subtasks, checklists and attachments
- Agenda's own push notifications (the next step after v0, see Reminders)
- Linking items to other sections (e.g. a dinner event to a recipe)

## Branding

Logo: `logos/agenda.svg`. The theme colours come from the logo, like every other section.
