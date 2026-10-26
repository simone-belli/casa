-- Casa: the household's seasons, for Ricettario's "In season" filter.
-- Months (1-12) of the hot season; the others are the cold season.

alter table public.household_settings
  add column if not exists hot_months smallint[] not null default '{5,6,7,8,9}'
  check (hot_months <@ '{1,2,3,4,5,6,7,8,9,10,11,12}'::smallint[]);
