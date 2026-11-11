-- Day counter integrity (T93, from the maintainer check after T18).

-- 1. Every attempt carries the weight it was counted with. The before-insert trigger always sets
-- it, and attempts reference profiles (whose weight is not null), so only rows from before T17
-- could lack it; backfill those from their profile first.
update public.attempts a set counted_weight = p.weight
  from public.profiles p
 where p.id = a.user_id and a.counted_weight is null;
alter table public.attempts alter column counted_weight set not null;

-- 2. Stamping the weight needs no extra rights: only the server (service role) inserts attempts,
-- and a refused insert never gets as far as needing the weight.
create or replace function public.stamp_attempt_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select p.weight into new.counted_weight from public.profiles p where p.id = new.user_id;
  return new;
end;
$$;

-- 3. A start on a closed day is refused, so a start racing the close job cannot change a day's
-- counts after its outcome is fixed. The day row is share-locked, so the close job (which
-- updates it) waits for this start to commit, or this start waits for the close and then sees
-- it. SQLSTATE WS001 lets the start endpoint answer 409 day-closed.
create or replace function public.count_started_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed_at timestamptz;
begin
  select d.closed_at into v_closed_at from public.game_days d where d.game_date = new.game_date for share;
  if v_closed_at is not null then
    raise exception 'game day % is closed', new.game_date using errcode = 'WS001';
  end if;
  insert into public.game_day_counters as c (game_date, attempts, weighted_attempts)
  values (new.game_date, 1, new.counted_weight)
  on conflict (game_date) do update
    set attempts = c.attempts + 1,
        weighted_attempts = c.weighted_attempts + excluded.weighted_attempts,
        updated_at = now();
  return null;
end;
$$;

revoke all on function public.stamp_attempt_weight() from public, anon, authenticated;
revoke all on function public.count_started_attempt() from public, anon, authenticated;

-- 4. A recorded pass must land in its day's counters. Every attempt creates that row when it
-- starts, so a missing row is a broken invariant: raise (the whole call, result included, rolls
-- back) instead of recording a pass nobody counted.
create or replace function public.record_attempt_result(
  p_attempt_id uuid,
  p_inputs jsonb,
  p_score numeric,
  p_passed boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_game_date date;
  v_submitted_at timestamptz;
  v_closed_at timestamptz;
  v_weight numeric;
  v_counted integer;
begin
  select a.game_date, a.submitted_at, d.closed_at, a.counted_weight
    into v_game_date, v_submitted_at, v_closed_at, v_weight
    from public.attempts a
    join public.game_days d on d.game_date = a.game_date
   where a.id = p_attempt_id
     for update of a
     for share of d;

  if not found then
    return 'not-found';
  elsif v_submitted_at is not null then
    return 'already-submitted';
  elsif v_closed_at is not null or v_game_date <> public.game_date_at(now()) then
    -- Closed by the close job, or past its deadline and not closed yet: either way too late.
    return 'day-closed';
  end if;

  update public.attempts
     set inputs = p_inputs, score = p_score, passed = p_passed, submitted_at = now()
   where id = p_attempt_id;

  -- The attempt itself was counted when it started; only a pass adds anything now.
  if p_passed then
    update public.game_day_counters
       set passes = passes + 1,
           weighted_passes = weighted_passes + v_weight,
           updated_at = now()
     where game_date = v_game_date;
    get diagnostics v_counted = row_count;
    if v_counted = 0 then
      raise exception 'no counters row for game day %', v_game_date;
    end if;
  end if;
  return 'recorded';
end;
$$;

-- create or replace keeps the grants, but restate them so this file stands alone.
revoke all on function public.record_attempt_result(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result(uuid, jsonb, numeric, boolean) to service_role;
