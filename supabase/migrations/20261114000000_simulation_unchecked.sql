-- The local multi-day simulation (T37, option A in docs/DECISIONS.md) plays and closes days that
-- are not today. The two "unchecked" functions below skip only the today and deadline checks;
-- every other rule (one result per attempt, no result on a closed day, closing in order) stays.
-- They are service-role only, and `npm run simulate:days` refuses any non-local database.

-- close_game_day as in T34, without the deadline check.
create function public.close_game_day_unchecked(d date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day public.game_days;
  v_counters public.game_day_counters;
  v_cycle public.cycles;
  v_rate numeric;
  v_outcome text;
  v_run_length integer;
begin
  -- A day nobody started has no row yet; it closes like any other (broken, with no attempts).
  perform public.ensure_game_day(d);
  -- Lock the day before reading its counters: a start holds a share lock on the day row while
  -- it counts, so this order cannot miss a start or deadlock with one (T93). The lock also makes
  -- concurrent closes of the same day wait, then see it closed.
  select * into v_day from public.game_days where game_date = d for update;
  if v_day.closed_at is not null then
    perform public.prepare_next_cycle(d);
    perform public.ensure_game_day(d + 1);
    return v_day.outcome;
  end if;

  if exists (select 1 from public.game_days where game_date < d and closed_at is null) then
    raise exception 'an earlier game day is still open; close days in order';
  end if;

  select * into v_counters from public.game_day_counters where game_date = d;
  -- No weighted attempts (nobody played, or only zero-weight accounts): no rate, and the day
  -- is broken. A judgment call (docs/DECISIONS.md, T21).
  if coalesce(v_counters.weighted_attempts, 0) > 0 then
    v_rate := v_counters.weighted_passes / v_counters.weighted_attempts;
  end if;
  v_outcome := case when v_rate is not null and v_rate >= v_day.survival_threshold then 'survived' else 'broken' end;

  update public.game_days
    set final_pass_rate = v_rate, outcome = v_outcome, closed_at = now()
    where game_date = d;

  -- Cycle: the first day of a cycle ends the run from before it, whatever this day's outcome.
  select * into v_cycle from public.cycles where d between start_date and end_date for update;
  if v_cycle.start_date = d then
    update public.streak_runs set end_date = start_date + length - 1 where end_date is null;
  end if;

  -- A survived day extends the open run only if that run's last day is the day before. A day
  -- with no row at all (never prepared, so never closed) is a gap, which counts as not survived:
  -- the open run ends on its last survived day, as it does on a broken day.
  update public.streak_runs set length = length + 1
    where end_date is null and v_outcome = 'survived' and start_date + length = d;
  if not found then
    update public.streak_runs set end_date = start_date + length - 1 where end_date is null;
    if v_outcome = 'survived' then
      insert into public.streak_runs (start_date, length) values (d, 1);
    end if;
  end if;

  -- Cycle: the run started inside the cycle, so its length is days inside it. Only the first
  -- time counts; the cycle then runs on to its last day.
  if v_cycle.number is not null and v_cycle.goal_reached_on is null then
    select length into v_run_length from public.streak_runs where end_date is null;
    if v_run_length >= 30 then
      update public.cycles set goal_reached_on = d where number = v_cycle.number;
    end if;
  end if;
  perform public.prepare_next_cycle(d);

  -- The next day, with the streak as it now stands.
  perform public.ensure_game_day(d + 1);
  return v_outcome;
end;
$$;
revoke all on function public.close_game_day_unchecked(date) from public, anon, authenticated;
grant execute on function public.close_game_day_unchecked(date) to service_role;

-- The scheduled job's close: only days past their deadline, then the shared steps.
create or replace function public.close_game_day(d date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if d >= public.game_date_at(now()) then
    raise exception 'game day % has not reached its deadline', d;
  end if;
  return public.close_game_day_unchecked(d);
end;
$$;
revoke all on function public.close_game_day(date) from public, anon, authenticated;
grant execute on function public.close_game_day(date) to service_role;

-- record_attempt_result as in T35, for an attempt on any open day, not only today's.
create function public.record_attempt_result_unchecked(
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
  v_user_id uuid;
  v_game_date date;
  v_submitted_at timestamptz;
  v_closed_at timestamptz;
  v_weight numeric;
  v_counted integer;
  v_cycle integer;
begin
  select a.user_id, a.game_date, a.submitted_at, d.closed_at, a.counted_weight
    into v_user_id, v_game_date, v_submitted_at, v_closed_at, v_weight
    from public.attempts a
    join public.game_days d on d.game_date = a.game_date
   where a.id = p_attempt_id
     for update of a
     for share of d;

  if not found then
    return 'not-found';
  elsif v_submitted_at is not null then
    return 'already-submitted';
  elsif v_closed_at is not null then
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

    v_cycle := public.cycle_for(v_game_date);
    if v_cycle is not null then
      insert into public.entries (attempt_id, user_id, cycle_number, game_date)
      values (p_attempt_id, v_user_id, v_cycle, v_game_date);
    end if;
  end if;
  return 'recorded';
end;
$$;
revoke all on function public.record_attempt_result_unchecked(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result_unchecked(uuid, jsonb, numeric, boolean) to service_role;

-- The app's submit: a result only for today's game day, then the shared steps. The unchecked
-- function re-reads the attempt under its locks, so a submit racing this read is still safe;
-- the statuses keep their order (not-found, already-submitted, day-closed).
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
begin
  select a.game_date, a.submitted_at into v_game_date, v_submitted_at
    from public.attempts a where a.id = p_attempt_id;
  -- Past its deadline and not closed yet is too late as well.
  if found and v_submitted_at is null and v_game_date <> public.game_date_at(now()) then
    return 'day-closed';
  end if;
  return public.record_attempt_result_unchecked(p_attempt_id, p_inputs, p_score, p_passed);
end;
$$;
revoke all on function public.record_attempt_result(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result(uuid, jsonb, numeric, boolean) to service_role;
