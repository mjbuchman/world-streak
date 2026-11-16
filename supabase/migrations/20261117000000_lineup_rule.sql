-- The pool and the lineup rule (T150). Each day plays three different games from the pool, in an
-- order the daily seed picks; a day never repeats the previous day's exact lineup.

alter table public.game_settings
  add column pool text[] not null default '{stacking,inner-clock,flash-count,echo-path,fair-split}'
  -- cardinality, not array_length (null for an empty array, which a check lets by).
  constraint game_settings_pool_size check (cardinality(pool) >= 3 and array_position(pool, null) is null);

-- Known games only, each once (a check constraint cannot read another table).
create function public.check_pool() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unknown text;
begin
  select p into v_unknown from unnest(new.pool) as p
   where not exists (select 1 from public.challenge_types t where t.type = p) limit 1;
  if v_unknown is not null then
    raise exception 'unknown challenge type % in the pool', v_unknown;
  end if;
  if cardinality(new.pool) <> (select count(distinct p) from unnest(new.pool) as p) then
    raise exception 'the pool names a game more than once';
  end if;
  return new;
end;
$$;

create trigger game_settings_check_pool
  before insert or update of pool on public.game_settings
  for each row execute function public.check_pool();

/** The daily seed: the first 32 bits of the MD5 of the date as YYYY-MM-DD, from 0 to 2^32 - 1. */
create function public.daily_seed(d date) returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select ('x' || left(md5(to_char(d, 'YYYY-MM-DD')), 8))::bit(32)::bigint;
$$;

-- Lineup number `i` of the n × (n - 1) × (n - 2) ordered lineups of a pool of n distinct games,
-- read as mixed-radix digits: the first game's place in the pool, then the second's among the
-- games left, then the third's. Every number below that count gives a different lineup.
create function public.lineup_at(pool text[], i bigint) returns text[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  n bigint := cardinality(pool);
  v_first text;
  v_second text;
  v_rest text[];
begin
  v_first := pool[i / ((n - 1) * (n - 2)) + 1];
  v_rest := array_remove(pool, v_first);
  v_second := v_rest[(i / (n - 2)) % (n - 1) + 1];
  v_rest := array_remove(v_rest, v_second);
  return array[v_first, v_second, v_rest[i % (n - 2) + 1]];
end;
$$;

/**
 * Day `d`'s lineup: lineup number daily_seed(d) mod the lineup count, in the pool's order. If that
 * is exactly `previous` (the day before's lineup), the next number's lineup instead, which differs
 * because every number gives a different lineup. Public: settings are readable by everyone.
 */
create function public.lineup_for(d date, previous text[]) returns text[]
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pool text[];
  v_count bigint;
  v_index bigint;
  v_lineup text[];
begin
  select pool into v_pool from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  v_count := cardinality(v_pool)::bigint * (cardinality(v_pool) - 1) * (cardinality(v_pool) - 2);
  v_index := public.daily_seed(d) % v_count;
  v_lineup := public.lineup_at(v_pool, v_index);
  if v_lineup = previous then
    v_lineup := public.lineup_at(v_pool, (v_index + 1) % v_count);
  end if;
  return v_lineup;
end;
$$;

grant execute on function public.daily_seed(date) to anon, authenticated;
grant execute on function public.lineup_at(text[], bigint) to anon, authenticated;
grant execute on function public.lineup_for(date, text[]) to anon, authenticated;
