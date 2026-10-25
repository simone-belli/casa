-- Casa: Groceries gets a Freezer home place, after Fridge:
-- Fruit, Fridge, Freezer, Pantry, Bathroom, Clean & wash, Other.
-- Run once after 0003_fixed_home_places.sql. Harmless if Freezer already exists.

insert into public.grocery_places (name, position)
select 'Freezer', 2
where not exists (select 1 from public.grocery_places where name = 'Freezer');

update public.grocery_places set position = case name
  when 'Fruit' then 0
  when 'Fridge' then 1
  when 'Freezer' then 2
  when 'Pantry' then 3
  when 'Bathroom' then 4
  when 'Clean & wash' then 5
  else 6
end;
