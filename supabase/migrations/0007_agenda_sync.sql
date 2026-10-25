-- Casa: Agenda ↔ Google Calendar sync details.
-- Run once in the Supabase SQL editor after 0006_agenda.sql. Safe to run again.

-- What was last written to Google for each item, as a hash, so the server
-- knows what changed (including things that don't touch the item itself,
-- like a proposal). Null means "write it again".
alter table public.agenda_google_links add column if not exists pushed_hash text;

-- Where Google sends change notifications, and the last problem syncing.
alter table public.agenda_sync_state add column if not exists channel_address text;
alter table public.agenda_sync_state add column if not exists last_error text;
alter table public.agenda_sync_state add column if not exists time_zone text;

-- The phones see the connection as soon as an account is connected, before
-- a calendar is picked, and the last error.
drop function if exists public.agenda_sync_status();

create function public.agenda_sync_status()
returns table (google_account text, calendar_name text, last_sync_at timestamptz, last_error text, live boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.google_account, s.calendar_name, s.last_sync_at, s.last_error,
    coalesce(s.channel_expires_at > now(), false)
  from public.agenda_sync_state s
  where public.is_member() and s.google_account is not null;
$$;

revoke all on function public.agenda_sync_status() from public, anon;
grant execute on function public.agenda_sync_status() to authenticated;
