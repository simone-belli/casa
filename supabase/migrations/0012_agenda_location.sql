-- Casa: Agenda keeps an item's place (Google Calendar's "location"), and the
-- sync remembers what Google last had for each event, so it writes back only
-- what changed in Agenda and leaves the rest of the event (place, default
-- reminders, attendees, video calls, attachments…) as it is in Google.
-- Run once after 0011_specialist_shops.sql; safe to run again.

alter table public.agenda_items add column if not exists location text;

alter table public.agenda_google_links add column if not exists pushed_body jsonb;

comment on column public.agenda_google_links.pushed_body is
  'What Google last had for the event, as Agenda writes it. Only fields that differ from it are written. Null: written in full.';

-- Read every event again on the next sync, so existing items pick up their place.
update public.agenda_sync_state set sync_token = null;
