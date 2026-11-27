-- Confusing Colors joins the daily pool (T241): days not yet created draw three of six games.
-- Days already created keep their lineups (the lineup rule never rewrites an existing day).
alter table public.game_settings alter column pool
  set default '{stacking,inner-clock,flash-count,echo-path,fair-split,ink}';

-- The settings row gets `ink` only while its pool is still the five-game launch pool (in any
-- order): a pool the admin edited is theirs to change. game_settings holds a single row.
update public.game_settings set pool = pool || '{ink}'
 where not 'ink' = any(pool)
   and pool @> '{stacking,inner-clock,flash-count,echo-path,fair-split}' and cardinality(pool) = 5;
