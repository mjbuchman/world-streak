-- Game days and scored attempts.

-- The global deadline hour (UTC). Mirrors DEADLINE_UTC_HOUR in src/config/schedule.ts on
-- purpose: the close job runs here. A shared fixture is tested on both sides; change both.
create or replace function public.deadline_utc_hour()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 0;
$$;

-- The game date being played at `ts`: the date that closes at the next deadline. Mirrors
-- gameDateAt in src/lib/gameDay.ts.
create or replace function public.game_date_at(ts timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select ((ts at time zone 'UTC') - make_interval(hours => public.deadline_utc_hour()))::date;
$$;

revoke all on function public.deadline_utc_hour() from public;
revoke all on function public.game_date_at(timestamptz) from public;
grant execute on function public.deadline_utc_hour() to anon, authenticated, service_role;
grant execute on function public.game_date_at(timestamptz) to anon, authenticated, service_role;

-- One row per game date: which challenge is played, the bar to pass, and (after the close
-- job) how the day ended.
create table public.game_days (
  game_date date primary key,
  -- No check against a list: new challenges (T26, T28) would each need a migration.
  challenge_type text not null,
  pass_target numeric not null,
  survival_threshold numeric not null check (survival_threshold between 0 and 1),
  final_pass_rate numeric,
  outcome text check (outcome in ('survived', 'broken')),
  closed_at timestamptz
);

alter table public.game_days enable row level security;

-- The day's challenge, target and outcome are public. There are no write policies: game days
-- are created by ensure_game_day and closed by the close job, both run by the server.
create policy game_days_select_all on public.game_days
  for select to anon, authenticated
  using (true);

-- One scored attempt per player per game date. The server inserts the row (with the seed it
-- issued) when the attempt starts and fills in the result when it is submitted.
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  game_date date not null references public.game_days,
  seed bigint not null check (seed between 0 and 4294967295),
  inputs jsonb,
  score numeric,
  passed boolean,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  -- The database, not just the code, enforces one attempt per account per day.
  unique (user_id, game_date)
);

alter table public.attempts enable row level security;

-- Players may read their own attempts. There are no insert, update or delete policies: the
-- start and submit endpoints write with the service role, so a player can never choose a
-- seed, set a score or try twice.
create policy attempts_select_own on public.attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Creates the game day `d` with the launch defaults if it does not exist yet; otherwise does
-- nothing. The defaults (stacking, a 10-block placeholder target, a 60% survival threshold)
-- move into game_settings in T16.
create or replace function public.ensure_game_day(d date)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
  values (d, 'stacking', 10, 0.60)
  on conflict (game_date) do nothing;
$$;

-- Server only: the attempt-start endpoint calls this with the service role.
revoke all on function public.ensure_game_day(date) from public;
grant execute on function public.ensure_game_day(date) to service_role;
