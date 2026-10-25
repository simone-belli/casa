-- Casa: Groceries home places become a fixed list, in this order:
-- Fruit, Fridge, Freezer, Pantry, Bathroom, Clean & wash, Other.
-- Run in the Supabase SQL editor after 0002_groceries.sql; safe to run again.
-- Items keep their places where there's an obvious match; anything else goes
-- to Other.

drop table if exists place_map;
create temporary table place_map (old_id uuid, new_name text);

insert into place_map (old_id, new_name)
select id,
  case
    when lower(trim(name)) in ('fruit', 'fruit & veg', 'fruit and veg', 'fruit and veggies') then 'Fruit'
    when lower(trim(name)) = 'fridge' then 'Fridge'
    when lower(trim(name)) = 'freezer' then 'Freezer'
    when lower(trim(name)) = 'pantry' then 'Pantry'
    when lower(trim(name)) = 'bathroom' then 'Bathroom'
    when lower(trim(name)) in ('cleaning', 'laundry', 'clean & wash') then 'Clean & wash'
    else 'Other'
  end
from public.grocery_places;

-- The seven places, created where missing.
insert into public.grocery_places (name, position)
select fixed.name, fixed.position
from (values ('Fruit', 0), ('Fridge', 1), ('Freezer', 2), ('Pantry', 3), ('Bathroom', 4), ('Clean & wash', 5), ('Other', 6)) as fixed (name, position)
where not exists (select 1 from public.grocery_places p where p.name = fixed.name);

-- Move items from the old places onto the fixed ones.
insert into public.grocery_item_places (item_id, place_id)
select ip.item_id, target.id
from public.grocery_item_places ip
join place_map m on m.old_id = ip.place_id
join public.grocery_places target on target.name = m.new_name
on conflict do nothing;

-- Remove every other place (their item links go with them).
delete from public.grocery_places
where name not in ('Fruit', 'Fridge', 'Freezer', 'Pantry', 'Bathroom', 'Clean & wash', 'Other');

update public.grocery_places set position = case name
  when 'Fruit' then 0
  when 'Fridge' then 1
  when 'Freezer' then 2
  when 'Pantry' then 3
  when 'Bathroom' then 4
  when 'Clean & wash' then 5
  else 6
end;

drop table place_map;

-- Places can still be read, but no longer added, renamed or deleted.
drop policy if exists "members manage grocery_places" on public.grocery_places;
drop policy if exists "members read grocery_places" on public.grocery_places;
create policy "members read grocery_places" on public.grocery_places
  for select to authenticated using (public.is_member());
