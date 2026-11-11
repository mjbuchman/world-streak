-- The daily close (T21): each game day's outcome and the world streak.

-- A day is closed with its outcome in one write: never one without the other (T11 review).
alter table public.game_days
  add constraint game_days_closed_with_outcome check ((outcome is null) = (closed_at is null));

-- One row per run of consecutive survived days. The open run (end_date null) is the current
-- streak; a broken day ends it. `length` counts its survived days.
create table public.streak_runs (
  id bigint generated always as identity primary key,
  start_date date not null,
  end_date date,
  length integer not null check (length >= 1),
  constraint streak_runs_end_after_start check (end_date is null or end_date >= start_date)
);
-- At most one open run: the world has one streak.
create unique index streak_runs_one_open on public.streak_runs ((true)) where end_date is null;

alter table public.streak_runs enable row level security;

-- The streak is public. There are no write policies: only close_game_day, running as its owner,
-- changes it.
create policy streak_runs_select_all on public.streak_runs
  for select to anon, authenticated
  using (true);
revoke all on public.streak_runs from anon, authenticated;
grant select on public.streak_runs to anon, authenticated;

-- Closes game day `d` once its deadline has passed: the final weighted pass rate, the outcome
-- and the streak. Keyed by date and idempotent: a day already closed is left as it is. Days
-- close in order, so the streak always extends from the day before. Returns the outcome.
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
  v_outcome := case when v_rate >= v_day.survival_threshold then 'survived' else 'broken' end;

  update public.game_days
    set final_pass_rate = v_rate, outcome = v_outcome, closed_at = now()
    where game_date = d;

  if v_outcome = 'survived' then
    update public.streak_runs set length = length + 1 where end_date is null;
    if not found then
      insert into public.streak_runs (start_date, length) values (d, 1);
    end if;
  else
    -- The run ends on its last survived day, the day before this one.
    update public.streak_runs set end_date = d - 1 where end_date is null;
  end if;

  return v_outcome;
end;
$$;

revoke all on function public.close_game_day(date) from public, anon, authenticated;
grant execute on function public.close_game_day(date) to service_role;

-- The world streak: the current run's length (0 after a broken day), the best run ever, and
-- when the current run started (null when there is none).
create or replace function public.world_streak()
returns table (current integer, best integer, current_start_date date)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((select length from public.streak_runs where end_date is null), 0),
    coalesce((select max(length) from public.streak_runs), 0),
    (select start_date from public.streak_runs where end_date is null);
$$;

revoke all on function public.world_streak() from public;
grant execute on function public.world_streak() to anon, authenticated, service_role;
