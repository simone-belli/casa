-- Ricettario: favourite recipes (shared by the household).
-- Safe to run again.

alter table public.recipes
  add column if not exists favourite boolean not null default false;

-- Starring a recipe isn't an edit: it keeps the recipe's "updated" time and
-- person, so it doesn't jump to the top of the lists or warn someone who is
-- editing it.
create or replace function public.touch_recipe_updated()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) - 'favourite' - 'updated_at' - 'updated_by')
     = (to_jsonb(old) - 'favourite' - 'updated_at' - 'updated_by') then
    new.updated_at = old.updated_at;
    new.updated_by = old.updated_by;
    return new;
  end if;
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists recipes_touch_updated on public.recipes;
create trigger recipes_touch_updated
  before update on public.recipes
  for each row execute function public.touch_recipe_updated();
