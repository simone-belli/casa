-- Casa: bug reports sent from the "Report a bug" screen.
-- The phones can only add reports; they're reviewed in the Supabase dashboard
-- (Table Editor → bug_reports), which isn't limited by these rules.

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  description text not null check (length(trim(description)) > 0 and length(description) <= 10000),
  -- The phone's browser, to help reproduce the bug.
  device text,
  -- 'open' when sent; set to 'fixed' or 'wontfix' when reviewed.
  status text not null default 'open' check (status in ('open', 'fixed', 'wontfix')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists bug_reports_created_at_idx on public.bug_reports (created_at desc);

alter table public.bug_reports enable row level security;

drop policy if exists "members report bugs" on public.bug_reports;
create policy "members report bugs" on public.bug_reports
  for insert to authenticated
  with check (public.is_member() and created_by = auth.uid() and status = 'open');
