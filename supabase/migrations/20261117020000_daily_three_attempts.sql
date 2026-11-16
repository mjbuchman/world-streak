-- The Daily Three's attempts (T152) and day results (T153). Each game of a day's lineup gets its
-- own scored attempt, started in the day's order and judged against its own target. A player's
-- day is decided by a majority of the day's games (two of three; one of one for the one-game days
-- from before T151); the pass rate becomes passed days over completed days.

-- 1. One attempt per game (T152).
alter table public.attempts
  add column position smallint not null default 1 check (position between 1 and 3),
  add column challenge_type text references public.challenge_types;
update public.attempts a set challenge_type = d.challenge_type from public.game_days d where d.game_date = a.game_date;
alter table public.attempts alter column challenge_type set not null;
alter table public.attempts drop constraint attempts_user_id_game_date_key;
alter table public.attempts
  add constraint attempts_one_per_position unique (user_id, game_date, position),
  add constraint attempts_one_per_game unique (user_id, game_date, challenge_type);

-- A day inserted directly (tests and local tools) starts with its first game in the lineup, as
-- ensure_game_day gives every day it creates; mirror_first_game keeps it in step after that.
create function public.add_first_game() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_day_games (game_date, position, challenge_type, pass_target)
  values (new.game_date, 1, new.challenge_type, new.pass_target)
  on conflict (game_date, position) do nothing;
  return null;
end;
$$;
revoke execute on function public.add_first_game() from public, anon, authenticated;
create trigger game_days_add_first_game
  after insert on public.game_days
  for each row execute function public.add_first_game();

-- An attempt takes its game from the lineup, and game k starts only after games 1 to k-1 have
-- (the day's order). The share lock on the day waits for an ensure_game_day rebuilding the lineup,
-- so the game read below is the one the day keeps. SQLSTATE WS004 marks a start out of order.
create function public.check_attempt_game() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.game_days where game_date = new.game_date for share;
  select g.challenge_type into new.challenge_type
    from public.game_day_games g where g.game_date = new.game_date and g.position = new.position;
  if not found then
    raise exception 'game day % has no game %', new.game_date, new.position using errcode = 'WS004';
  end if;
  if (select count(*) from public.attempts a
       where a.user_id = new.user_id and a.game_date = new.game_date and a.position < new.position) < new.position - 1 then
    raise exception 'start games 1 to % of game day % first', new.position - 1, new.game_date using errcode = 'WS004';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_attempt_game() from public, anon, authenticated;
create trigger attempts_check_game
  before insert on public.attempts
  for each row execute function public.check_attempt_game();

-- 2. Day results (T153), maintained only by the attempt functions below.
create table public.day_results (
  user_id uuid not null references public.profiles on delete cascade,
  game_date date not null references public.game_days,
  wins smallint not null default 0 check (wins >= 0),
  -- A started game counts as a loss until its pass is recorded: leaving early is a loss.
  losses smallint not null default 0 check (losses >= 0),
  outcome text check (outcome in ('passed', 'failed')),
  decided_at timestamptz,
  -- The weight of the day's first attempt, so a day counts with one weight throughout.
  counted_weight numeric not null check (counted_weight >= 0),
  primary key (user_id, game_date),
  constraint day_results_decided_when check ((outcome is null) = (decided_at is null))
);
alter table public.day_results enable row level security;
create policy day_results_select_own on public.day_results
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.day_results from anon, authenticated;
grant select on public.day_results to authenticated;

alter table public.game_day_counters
  add column completed_days integer not null default 0 check (completed_days >= 0),
  add column passed_days integer not null default 0 check (passed_days >= 0),
  add column weighted_completed_days numeric not null default 0 check (weighted_completed_days >= 0),
  add column weighted_passed_days numeric not null default 0 check (weighted_passed_days >= 0),
  add constraint game_day_counters_passed_within_completed check (passed_days <= completed_days),
  add constraint game_day_counters_weighted_passed_within_completed check (weighted_passed_days <= weighted_completed_days);

-- Rebuilds player `p_user`'s result for day `d` from their attempts. With `p_count`, the change
-- moves the day's completed and passed counters, and a newly passed day inside a cycle earns its
-- one entry, for `p_attempt` (the game that passed it). Wins are final and only pending games
-- can turn from loss to win, so a day decided by recorded results can never change; a day that
-- is failed only because a game is still open becomes open again if that game passes.
create function public.refresh_day_result(p_user uuid, d date, p_attempt uuid, p_count boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.day_results;
  v_games integer;
  v_wins integer;
  v_losses integer;
  v_weight numeric;
  v_outcome text;
  v_done integer;
  v_pass integer;
  v_cycle integer;
begin
  -- Locked before the counters, in every caller, so two changes to one day cannot deadlock.
  select * into v_old from public.day_results where user_id = p_user and game_date = d for update;
  select count(*) filter (where passed), count(*) filter (where passed is not true),
         (array_agg(counted_weight order by position))[1]
    into v_wins, v_losses, v_weight
    from public.attempts where user_id = p_user and game_date = d;
  if v_wins + v_losses = 0 then
    delete from public.day_results where user_id = p_user and game_date = d;
    return;
  end if;

  select count(*) into v_games from public.game_day_games where game_date = d;
  v_outcome := case when v_wins * 2 > v_games then 'passed' when v_losses * 2 > v_games then 'failed' end;
  v_weight := coalesce(v_old.counted_weight, v_weight);

  insert into public.day_results as r (user_id, game_date, wins, losses, outcome, decided_at, counted_weight)
  values (p_user, d, v_wins, v_losses, v_outcome, case when v_outcome is not null then now() end, v_weight)
  on conflict (user_id, game_date) do update
    set wins = excluded.wins, losses = excluded.losses, outcome = excluded.outcome,
        decided_at = case when r.outcome is not distinct from excluded.outcome then r.decided_at else excluded.decided_at end;

  v_done := (v_outcome is not null)::integer - (v_old.outcome is not null)::integer;
  v_pass := coalesce(v_outcome = 'passed', false)::integer -coalesce(v_old.outcome = 'passed', false)::integer;
  if not p_count or (v_done = 0 and v_pass = 0) then
    return;
  end if;
  update public.game_day_counters
     set completed_days = completed_days + v_done,
         passed_days = passed_days + v_pass,
         weighted_completed_days = weighted_completed_days + v_done * v_weight,
         weighted_passed_days = weighted_passed_days + v_pass * v_weight,
         updated_at = now()
   where game_date = d;
  if not found then
    raise exception 'no counters row for game day %', d;
  end if;

  if v_pass = 1 and p_attempt is not null then
    v_cycle := public.cycle_for(d);
    if v_cycle is not null then
      insert into public.entries (attempt_id, user_id, cycle_number, game_date) values (p_attempt, p_user, v_cycle, d);
    end if;
  end if;
end;
$$;
revoke all on function public.refresh_day_result(uuid, date, uuid, boolean) from public, anon, authenticated;

-- count_started_attempt as in T93, plus the start's loss in the player's day.
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
  -- The row must exist before the day result counts into it; an existing row is not locked here.
  insert into public.game_day_counters (game_date) values (new.game_date) on conflict (game_date) do nothing;
  -- A start passes nothing, so it earns no entry (an attempt inserted with a result, as the
  -- local tools do, gets the one they add).
  perform public.refresh_day_result(new.user_id, new.game_date, null, true);
  update public.game_day_counters
     set attempts = attempts + 1,
         weighted_attempts = weighted_attempts + new.counted_weight,
         updated_at = now()
   where game_date = new.game_date;
  return null;
end;
$$;
revoke all on function public.count_started_attempt() from public, anon, authenticated;

-- A deleted attempt (the local tools) takes its part of the day result with it. Counters are not
-- touched, as before: the tools correct them or call recount_game_day.
create function public.forget_deleted_attempt() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_day_result(old.user_id, old.game_date, null, false);
  return null;
end;
$$;
revoke execute on function public.forget_deleted_attempt() from public, anon, authenticated;
create trigger attempts_forget_deleted
  after delete on public.attempts
  for each row execute function public.forget_deleted_attempt();

-- Day results for the attempts so far (one-game days), and their counters.
select public.refresh_day_result(user_id, game_date, null, false)
  from (select distinct user_id, game_date from public.attempts) s;
update public.game_day_counters c
   set completed_days = s.completed, passed_days = s.passed,
       weighted_completed_days = s.weighted_completed, weighted_passed_days = s.weighted_passed
  from (
    select game_date,
           (count(*) filter (where outcome is not null))::integer as completed,
           (count(*) filter (where outcome = 'passed'))::integer as passed,
           coalesce(sum(counted_weight) filter (where outcome is not null), 0) as weighted_completed,
           coalesce(sum(counted_weight) filter (where outcome = 'passed'), 0) as weighted_passed
      from public.day_results group by game_date
  ) s
 where c.game_date = s.game_date;

-- record_attempt_result_unchecked as in T37, judged against the game's own target, with the day
-- result updated and the entry moved to the day's pass. Until the endpoints move (T154) callers
-- still send the pass they judged; one that disagrees with the database is refused (WS005).
create or replace function public.record_attempt_result_unchecked(
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
  v_attempt public.attempts;
  v_closed_at timestamptz;
  v_target numeric;
  v_direction text;
  v_passed boolean;
begin
  -- The day's lock first, as a start takes it; then the attempt.
  select d.closed_at into v_closed_at
    from public.attempts a
    join public.game_days d on d.game_date = a.game_date
   where a.id = p_attempt_id
     for share of d;
  select a.* into v_attempt
    from public.attempts a
    join public.game_days d on d.game_date = a.game_date
   where a.id = p_attempt_id
     for update of a
     for share of d;

  if not found then
    return 'not-found';
  elsif v_attempt.submitted_at is not null then
    return 'already-submitted';
  elsif v_closed_at is not null then
    return 'day-closed';
  end if;

  select g.pass_target, t.direction into v_target, v_direction
    from public.game_day_games g join public.challenge_types t on t.type = g.challenge_type
   where g.game_date = v_attempt.game_date and g.position = v_attempt.position;
  v_passed := coalesce(case when v_direction = 'higher-better' then p_score >= v_target else p_score <= v_target end, false);
  if p_passed is distinct from v_passed then
    raise exception 'a score of % on game % of % gives passed = %', p_score, v_attempt.position, v_attempt.game_date, v_passed
      using errcode = 'WS005';
  end if;

  update public.attempts
     set inputs = p_inputs, score = p_score, passed = v_passed, submitted_at = now()
   where id = p_attempt_id;
  perform public.refresh_day_result(v_attempt.user_id, v_attempt.game_date, p_attempt_id, true);

  -- The attempt itself was counted when it started; only a pass adds anything now.
  if v_passed then
    update public.game_day_counters
       set passes = passes + 1,
           weighted_passes = weighted_passes + v_attempt.counted_weight,
           updated_at = now()
     where game_date = v_attempt.game_date;
    if not found then
      raise exception 'no counters row for game day %', v_attempt.game_date;
    end if;
  end if;
  return 'recorded';
end;
$$;
revoke all on function public.record_attempt_result_unchecked(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result_unchecked(uuid, jsonb, numeric, boolean) to service_role;

-- pass_target_for as in T22, over each game's own attempts, leaving out a game played after the
-- player's day was already decided by the games before it (a majority of wins or of losses).
create or replace function public.pass_target_for(challenge text, d date, streak integer)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  s public.game_settings;
  v_direction text;
  v_count integer;
  v_base numeric;
  v_step numeric;
begin
  select * into s from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  select direction into v_direction from public.challenge_types where type = challenge;
  if not found then
    raise exception 'unknown challenge type %', challenge;
  end if;

  -- percentile_disc(p) is the first score, best first, at which the share so far reaches p: the
  -- ceil(p × n)-th best.
  select
    count(*),
    case when v_direction = 'higher-better'
      then percentile_disc(s.pass_target_percentile) within group (order by a.score desc)
      else percentile_disc(s.pass_target_percentile) within group (order by a.score)
    end
  into v_count, v_base
  from public.attempts a
  where a.challenge_type = challenge
    and a.submitted_at is not null and a.score is not null
    and a.game_date between d - s.percentile_lookback_days and d - 1
    and (select greatest(count(*) filter (where e.passed), count(*) filter (where e.passed is not true)) * 2
           from public.attempts e
          where e.user_id = a.user_id and e.game_date = a.game_date and e.position < a.position)
        <= (select count(*) from public.game_day_games g where g.game_date = a.game_date);

  if v_count < s.percentile_min_sample then
    v_base := (s.default_pass_targets ->> challenge)::numeric;
    if v_base is null then
      raise exception 'no default pass target for %', challenge;
    end if;
  end if;

  v_step := s.pass_target_streak_step * streak;
  return case when v_direction = 'higher-better' then v_base + v_step else greatest(v_base - v_step, 0) end;
end;
$$;
revoke all on function public.pass_target_for(text, date, integer) from public, anon, authenticated;
grant execute on function public.pass_target_for(text, date, integer) to service_role;

-- recount_game_day as in T129, with the completed-day counters from the day results.
create or replace function public.recount_game_day(d date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1 from public.game_days where game_date = d for update;
  -- A closed day's counters are final (its outcome is fixed); a day with no row has none.
  if not exists (select 1 from public.game_days where game_date = d and closed_at is null) then
    return;
  end if;
  -- A new statement, so it sees every start that committed before the lock.
  update public.game_day_counters c
     set attempts = s.attempts,
         passes = s.passes,
         weighted_attempts = s.weighted_attempts,
         weighted_passes = s.weighted_passes,
         completed_days = r.completed,
         passed_days = r.passed,
         weighted_completed_days = r.weighted_completed,
         weighted_passed_days = r.weighted_passed,
         updated_at = now()
    from (
      select count(*)::integer as attempts,
             (count(*) filter (where a.passed))::integer as passes,
             coalesce(sum(a.counted_weight), 0) as weighted_attempts,
             coalesce(sum(a.counted_weight) filter (where a.passed), 0) as weighted_passes
        from public.attempts a
       where a.game_date = d
    ) s, (
      select (count(*) filter (where outcome is not null))::integer as completed,
             (count(*) filter (where outcome = 'passed'))::integer as passed,
             coalesce(sum(counted_weight) filter (where outcome is not null), 0) as weighted_completed,
             coalesce(sum(counted_weight) filter (where outcome = 'passed'), 0) as weighted_passed
        from public.day_results
       where game_date = d
    ) r
   where c.game_date = d;
end;
$$;
revoke all on function public.recount_game_day(date) from public, anon, authenticated;
grant execute on function public.recount_game_day(date) to service_role;

-- close_game_day_unchecked as in T37, with the rate over completed days.
create or replace function public.close_game_day_unchecked(d date)
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
  -- No weighted completed days (nobody finished, or only zero-weight accounts): no rate, and
  -- the day is broken. A judgment call (docs/DECISIONS.md, T21).
  if coalesce(v_counters.weighted_completed_days, 0) > 0 then
    v_rate := v_counters.weighted_passed_days / v_counters.weighted_completed_days;
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
