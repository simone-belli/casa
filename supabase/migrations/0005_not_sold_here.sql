-- Casa: Groceries items can be marked "not sold here" for a supermarket.
-- A filing with no aisle means the item isn't sold at that supermarket, so it
-- is left out of that supermarket's shopping list.
-- Run once after 0004_freezer.sql; safe to run again.

alter table public.grocery_item_aisles alter column aisle_id drop not null;

comment on column public.grocery_item_aisles.aisle_id is
  'The aisle the item is in at this supermarket; null means it is not sold there.';
