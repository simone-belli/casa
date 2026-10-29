-- Casa: Groceries stores can be specialist shops (a chemist, a hardware
-- store) as well as supermarkets. A shop has no aisles to set up: the app
-- gives it one hidden aisle, and an item is sold there when it's filed under
-- it. Anything else, including every item added later, isn't sold there.
-- Run once after 0010_grocery_amounts.sql; safe to run again.

alter table public.grocery_stores
  add column if not exists kind text not null default 'supermarket';

alter table public.grocery_stores drop constraint if exists grocery_stores_kind_check;
alter table public.grocery_stores
  add constraint grocery_stores_kind_check check (kind in ('supermarket', 'shop'));

comment on column public.grocery_stores.kind is
  'supermarket: aisles in walking order. shop: no aisles; only items filed under its one aisle are sold there.';
