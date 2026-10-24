-- Casa: initial schema (Casa household settings + Ricettario recipes).
-- Run once in the Supabase SQL editor, or with `supabase db push`.

-- ---------------------------------------------------------------------------
-- Members: only these addresses can use the app.
-- ---------------------------------------------------------------------------

create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  display_name text not null
);

alter table public.allowed_emails enable row level security;
-- No policies: the table is only read through the security-definer
-- functions below, never directly by clients.

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_emails
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Names of the household members, keyed by auth user id, so the app can show
-- "Kat updated this recipe".
create or replace function public.household_members()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, a.display_name
  from auth.users u
  join public.allowed_emails a on a.email = lower(u.email)
  where public.is_member();
$$;

revoke all on function public.is_member() from public, anon;
revoke all on function public.household_members() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.household_members() to authenticated;

-- ---------------------------------------------------------------------------
-- Casa household settings (a single shared row).
-- ---------------------------------------------------------------------------

create table public.household_settings (
  id smallint primary key default 1 check (id = 1),
  default_adults smallint not null default 2 check (default_adults between 0 and 20),
  default_children smallint not null default 2 check (default_children between 0 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid()
);

insert into public.household_settings (id) values (1);

alter table public.household_settings enable row level security;

create policy "members read settings" on public.household_settings
  for select to authenticated using (public.is_member());
create policy "members update settings" on public.household_settings
  for update to authenticated using (public.is_member()) with check (public.is_member());

-- ---------------------------------------------------------------------------
-- Ricettario recipes.
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  notes text,
  tags text[] not null default '{}',
  kind text not null check (kind in ('portion', 'batch')),
  -- Only for batch recipes, e.g. "1 cake, 24 cm tin".
  yield text,
  -- Ordered list of {name, quantity, unit, scaling, note}; quantities are per
  -- adult portion (kind = 'portion') or per batch (kind = 'batch').
  ingredients jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array'),
  steps text[] not null default '{}',
  source_url text,
  source_text text,
  -- Object paths in the recipe-photos storage bucket.
  photo_paths text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_updated_at_idx on public.recipes (updated_at desc);

create or replace function public.touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger recipes_touch_updated
  before update on public.recipes
  for each row execute function public.touch_updated();

create trigger household_settings_touch_updated
  before update on public.household_settings
  for each row execute function public.touch_updated();

alter table public.recipes enable row level security;

create policy "members read recipes" on public.recipes
  for select to authenticated using (public.is_member());
create policy "members add recipes" on public.recipes
  for insert to authenticated with check (public.is_member());
create policy "members edit recipes" on public.recipes
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "members delete recipes" on public.recipes
  for delete to authenticated using (public.is_member());

-- Live updates for the recipe list and open recipes.
alter publication supabase_realtime add table public.recipes;

-- ---------------------------------------------------------------------------
-- Recipe photos (private bucket).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', false);

create policy "members read recipe photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member());
create policy "members upload recipe photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.is_member());
create policy "members delete recipe photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member());
