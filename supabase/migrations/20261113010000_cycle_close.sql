-- The close job knows about prize cycles (T34). The first day of a cycle starts a fresh streak
-- run, so the goal counts only days inside the cycle; the first close that brings the run to
-- STREAK_GOAL_DAYS sets the cycle's goal_reached_on; closing a cycle's last day creates the next
-- cycle with the prize rolled over if nobody won. The numbers match src/config/prize.ts.

-- Creates the cycle after the one ending on `d`, if `d` is a cycle's last day and it is missing.
-- A won cycle rolls nothing over; an unwon one rolls over its whole prize (as nextRolloverCents).
create function public.prepare_next_cycle(d date) returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.cycles (number, start_date, end_date, rollover_in_cents)
  select number + 1, end_date + 1, end_date + 60,
         case when goal_reached_on is null then base_prize_cents + rollover_in_cents else 0 end
    from public.cycles where end_date = d
  on conflict do nothing;
$$;
revoke all on function public.prepare_next_cycle(date) from public, anon, authenticated;

-- close_game_day as in T22, with the cycle steps marked "Cycle".
create or replace function public.close_game_day(d date)
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
  if d >= public.game_date_at(now()) then
    raise exception 'game day % has not reached its deadline', d;
  end if;

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
