-- Casa: Agenda (shared calendar and tasks, proposals, Google Calendar sync).
-- Run once in the Supabase SQL editor after 0005_not_sold_here.sql.

-- ---------------------------------------------------------------------------
-- Items: events and tasks.
-- ---------------------------------------------------------------------------

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event', 'task')),
  title text not null check (length(trim(title)) > 0),
  note text,
  -- Dated items are either all-day (start_date, optional inclusive end_date)
  -- or timed (starts_at, and ends_at, optional for tasks). Undated tasks have
  -- neither.
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  -- Where the times were chosen (IANA name, e.g. Europe/Rome); recurring
  -- items repeat at the same local time there.
  time_zone text not null default 'UTC',
  -- Google-style recurrence lines, e.g. {RRULE:FREQ=WEEKLY;BYDAY=TU}.
  recurrence text[],
  -- Recurring tasks only: keep occurrences that passed without being ticked
  -- off, listed as overdue.
  keep_missed boolean not null default false,
  -- A changed, deleted or ticked-off occurrence of a series. original_start
  -- is the occurrence's original start: YYYY-MM-DD for an all-day series,
  -- otherwise UTC as YYYY-MM-DDTHH:MM:SSZ.
  recurring_item_id uuid references public.agenda_items (id) on delete cascade,
  original_start text,
  -- The occurrence was deleted from the series.
  cancelled boolean not null default false,
  -- None, one or both household members.
  assignees uuid[] not null default '{}' check (cardinality(assignees) <= 2),
  task_status text check (task_status in ('open', 'done')),
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  -- Minutes before the start; null means no reminder.
  reminder_minutes integer check (reminder_minutes between 0 and 40320),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agenda_items_status_for_tasks check ((kind = 'task') = (task_status is not null)),
  constraint agenda_items_dates check (
    case
      when all_day then start_date is not null and starts_at is null and ends_at is null
        and (end_date is null or end_date >= start_date)
      else start_date is null and end_date is null
        and (ends_at is null or (starts_at is not null and ends_at >= starts_at))
    end
  ),
  constraint agenda_items_events_dated check (kind = 'task' or all_day or (starts_at is not null and ends_at is not null)),
  constraint agenda_items_recurrence_dated check (recurrence is null or all_day or starts_at is not null),
  constraint agenda_items_occurrence check (
    (recurring_item_id is null) = (original_start is null)
    and (recurring_item_id is null or recurrence is null)
    and (not cancelled or recurring_item_id is not null)
  )
);

create unique index agenda_items_occurrence_idx on public.agenda_items (recurring_item_id, original_start)
  where recurring_item_id is not null;

-- Tasks are open unless said otherwise; events have no status. Records who
-- ticked a task off, and when.
create or replace function public.agenda_items_mark_done()
returns trigger
language plpgsql
as $$
begin
  new.task_status = case when new.kind = 'task' then coalesce(new.task_status, 'open') end;
  if new.task_status = 'done' and (tg_op = 'INSERT' or old.task_status is distinct from 'done') then
    new.done_by = coalesce(auth.uid(), new.done_by);
    new.done_at = coalesce(new.done_at, now());
  elsif new.task_status is distinct from 'done' then
    new.done_by = null;
    new.done_at = null;
  end if;
  return new;
end;
$$;

create trigger agenda_items_mark_done
  before insert or update on public.agenda_items
  for each row execute function public.agenda_items_mark_done();

create trigger agenda_items_touch_updated
  before update on public.agenda_items
  for each row execute function public.touch_updated();

-- ---------------------------------------------------------------------------
-- Proposals: an assignment waiting for the other person's answer.
-- ---------------------------------------------------------------------------

create table public.agenda_proposals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.agenda_items (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  proposed_assignees uuid[] not null check (cardinality(proposed_assignees) between 1 and 2),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  -- The proposer has seen that it was declined (hides the "declined" label).
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one pending proposal per item.
create unique index agenda_proposals_pending_idx on public.agenda_proposals (item_id) where status = 'pending';
create index agenda_proposals_item_idx on public.agenda_proposals (item_id, created_at desc);

-- Accepting applies the proposed assignment; declining gives the item back to
-- the proposer alone. Only the other person can answer.
create or replace function public.agenda_answer_proposal(proposal_id uuid, accept boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.agenda_proposals;
begin
  select * into p from public.agenda_proposals where id = proposal_id and status = 'pending' for update;
  if not found then
    raise exception 'This proposal has already been answered or withdrawn.' using errcode = 'P0002';
  end if;
  if p.proposed_by = auth.uid() then
    raise exception 'You can''t answer your own proposal.' using errcode = '42501';
  end if;

  update public.agenda_proposals
    set status = case when accept then 'accepted' else 'declined' end,
        answered_by = auth.uid(),
        answered_at = now()
    where id = p.id;
  update public.agenda_items
    set assignees = case when accept then p.proposed_assignees else array[p.proposed_by] end
    where id = p.item_id;
end;
$$;

revoke all on function public.agenda_answer_proposal(uuid, boolean) from public, anon;
grant execute on function public.agenda_answer_proposal(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Per-person settings: the nudge about undecided tasks.
-- ---------------------------------------------------------------------------

create table public.agenda_settings (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  nudge_enabled boolean not null default true,
  -- 0 = Sunday … 6 = Saturday.
  nudge_weekday smallint not null default 0 check (nudge_weekday between 0 and 6),
  -- The day the nudge banner was last dismissed.
  nudge_dismissed_on date
);

-- ---------------------------------------------------------------------------
-- Google Calendar sync.
-- ---------------------------------------------------------------------------

-- Which Google event each item is written to.
create table public.agenda_google_links (
  item_id uuid primary key references public.agenda_items (id) on delete cascade,
  google_event_id text not null unique,
  google_etag text,
  last_synced_at timestamptz not null default now()
);

-- The connected calendar (a single row). Server only: no policies, so only
-- the service role can read it.
create table public.agenda_sync_state (
  id smallint primary key default 1 check (id = 1),
  google_account text,
  calendar_id text,
  calendar_name text,
  -- AES-GCM encrypted with AGENDA_TOKEN_KEY.
  refresh_token_encrypted text,
  sync_token text,
  last_sync_at timestamptz,
  channel_id text,
  channel_resource_id text,
  channel_token text,
  channel_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- What the phones may know about the connection (never the token).
create or replace function public.agenda_sync_status()
returns table (calendar_name text, google_account text, last_sync_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.calendar_name, s.google_account, s.last_sync_at
  from public.agenda_sync_state s
  where public.is_member() and s.calendar_id is not null;
$$;

revoke all on function public.agenda_sync_status() from public, anon;
grant execute on function public.agenda_sync_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Security: both members can read and change items and proposals; each
-- person changes only their own settings; Google links are read-only.
-- ---------------------------------------------------------------------------

alter table public.agenda_items enable row level security;
alter table public.agenda_proposals enable row level security;
alter table public.agenda_settings enable row level security;
alter table public.agenda_google_links enable row level security;
alter table public.agenda_sync_state enable row level security;
revoke all on public.agenda_sync_state from anon, authenticated;

create policy "members manage agenda_items" on public.agenda_items
  for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members manage agenda_proposals" on public.agenda_proposals
  for all to authenticated using (public.is_member()) with check (public.is_member());

create policy "members read agenda_settings" on public.agenda_settings
  for select to authenticated using (public.is_member());
create policy "members add own agenda_settings" on public.agenda_settings
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "members change own agenda_settings" on public.agenda_settings
  for update to authenticated using (public.is_member() and user_id = auth.uid())
  with check (public.is_member() and user_id = auth.uid());

create policy "members read agenda_google_links" on public.agenda_google_links
  for select to authenticated using (public.is_member());

-- Live updates on both phones.
alter publication supabase_realtime add table public.agenda_items;
alter publication supabase_realtime add table public.agenda_proposals;
