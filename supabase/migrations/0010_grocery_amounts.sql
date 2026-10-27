-- Casa: how much of a grocery item we need this time (e.g. "600 g"), filled in
-- when a recipe's ingredients are added to the list. It belongs to one
-- shopping trip, so it's cleared when the item is bought. Safe to run again.

alter table public.grocery_items add column if not exists amount text;

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
    new.amount = null;
  end if;
  return new;
end;
$$;
