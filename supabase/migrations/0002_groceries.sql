-- Casa: Groceries (shared shopping list, home places, supermarkets and aisles).
-- Run once in the Supabase SQL editor after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Home places: where things live at home (Fridge, Pantry…), in our order.
-- ---------------------------------------------------------------------------

create table public.grocery_places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.grocery_places (name, position) values
  ('Fridge', 0),
  ('Freezer', 1),
  ('Pantry', 2),
  ('Cleaning', 3),
  ('Bathroom', 4);

-- ---------------------------------------------------------------------------
-- Items: everything we buy, each either 'have' or 'need'.
-- ---------------------------------------------------------------------------

create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  -- Free text, e.g. "the Oatly one", "2 packs".
  note text,
  status text not null default 'have' check (status in ('have', 'need')),
  -- Needed just this once; deleted when bought.
  is_one_off boolean not null default false,
  -- Who last switched it to 'need', and when (set by the trigger below).
  needed_by uuid references auth.users (id) on delete set null,
  needed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One item per name, so quick add and the import find existing items.
create unique index grocery_items_name_idx on public.grocery_items (lower(trim(name)));

create or replace function public.grocery_items_mark_needed()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'need' and (tg_op = 'INSERT' or old.status is distinct from 'need') then
    new.needed_by = coalesce(auth.uid(), new.needed_by);
    new.needed_at = now();
  elsif new.status = 'have' then
    new.needed_by = null;
    new.needed_at = null;
  end if;
  return new;
end;
$$;

create trigger grocery_items_mark_needed
  before insert or update on public.grocery_items
  for each row execute function public.grocery_items_mark_needed();

create trigger grocery_items_touch_updated
  before update on public.grocery_items
  for each row execute function public.touch_updated();

-- An item can be in several home places.
create table public.grocery_item_places (
  item_id uuid not null references public.grocery_items (id) on delete cascade,
  place_id uuid not null references public.grocery_places (id) on delete cascade,
  primary key (item_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Supermarkets, their aisles in walking order, and where each item is filed.
-- ---------------------------------------------------------------------------

create table public.grocery_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.grocery_aisles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.grocery_stores (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0,
  unique (id, store_id)
);

-- One aisle per item per supermarket. Deleting an aisle un-files its items,
-- which then show under "Not sorted yet" for that supermarket.
create table public.grocery_item_aisles (
  item_id uuid not null references public.grocery_items (id) on delete cascade,
  store_id uuid not null references public.grocery_stores (id) on delete cascade,
  aisle_id uuid not null,
  primary key (item_id, store_id),
  foreign key (aisle_id, store_id) references public.grocery_aisles (id, store_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Security: both members can read and change everything.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'grocery_places', 'grocery_items', 'grocery_item_places',
    'grocery_stores', 'grocery_aisles', 'grocery_item_aisles'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members manage %1$s" on public.%1$I for all to authenticated
         using (public.is_member()) with check (public.is_member())',
      t
    );
    -- Live updates on both phones.
    execute format('alter publication supabase_realtime add table public.%I', t);
  end loop;
end;
$$;
