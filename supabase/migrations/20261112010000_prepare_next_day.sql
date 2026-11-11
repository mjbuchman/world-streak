-- Preparing the next game day (T22): its pass target from recent scores and its threshold from
-- the streak. One path creates every day: ensure_game_day, which the close calls for the day
-- after and an attempt start calls for today, so a start that beats the close still gets them.

-- Which way each challenge scores, kept in SQL so the database does not depend on the TS registry.
create table public.challenge_types (
  type text primary key,
  direction text not null check (direction in ('higher-better', 'lower-better'))
);
insert into public.challenge_types (type, direction) values ('stacking', 'higher-better');

alter table public.challenge_types enable row level security;
-- Public, like the game days that name them. No write policies: new challenges come by migration.
create policy challenge_types_select_all on public.challenge_types
  for select to anon, authenticated
  using (true);
revoke all on public.challenge_types from anon, authenticated;
grant select on public.challenge_types to anon, authenticated;

alter table public.game_days
  add constraint game_days_challenge_type_fkey foreign key (challenge_type) references public.challenge_types;

-- The pass target reads a range of game dates; the unique (user_id, game_date) index leads with
-- the user, so it cannot serve that.
create index attempts_game_date_idx on public.attempts (game_date);

-- The pass target for a day of `challenge` on date `d` with the world streak at `streak`. With at
-- least percentile_min_sample scored attempts of that challenge in the percentile_lookback_days
-- before `d`, it is the score a pass_target_percentile share of them reached: the k-th best score,
-- k = ceil(percentile × n), so at least that share scored as well or better and no stricter score
-- would keep it. Otherwise it is the challenge's default. The streak step then makes it harder.
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
  from public.attempts a join public.game_days g on g.game_date = a.game_date
  where g.challenge_type = challenge
    and a.submitted_at is not null and a.score is not null
    and a.game_date between d - s.percentile_lookback_days and d - 1;

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

-- Creates game day `d` if it is missing, never touching an existing row (for example one an
-- admin edited). Its threshold rises with the streak by threshold_streak_step a day, to at most
-- 0.95. The challenge stays stacking until the rotation (T31).
create or replace function public.ensure_game_day(d date)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  s public.game_settings;
  v_streak integer;
begin
  if exists (select 1 from public.game_days where game_date = d) then
    return;
  end if;
  select * into s from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  select current into v_streak from public.world_streak();
  insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
  values (
    d,
    'stacking',
    public.pass_target_for('stacking', d, v_streak),
    least(s.default_survival_threshold + s.threshold_streak_step * v_streak, 0.95)
  )
  on conflict (game_date) do nothing;
end;
$$;

-- close_game_day as in T21, plus preparing the next day once this one is closed (also on a
-- re-run, in case the next day is still missing).
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
  v_rate numeric;
  v_outcome text;
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

  -- The next day, with the streak as it now stands.
  perform public.ensure_game_day(d + 1);
  return v_outcome;
end;
$$;
