-- Running counters per game day, so the meter never counts attempt rows on request.
--
-- An attempt counts when it starts (a trigger on the attempt insert, in the same transaction as
-- the start endpoint's insert) and its pass counts when record_attempt_result records a pass.
-- So leaving early, or never submitting, counts as an attempt that did not pass (the human's
-- decision, Nov 9; see docs/DECISIONS.md). The pass rate is weighted_passes / weighted_attempts.

-- The weight an attempt was counted with: the player's profile weight when it started. The pass
-- adds the same weight, so a later weight change can never push weighted passes above weighted
-- attempts. Set by the trigger below; null only for rows from before this migration.
alter table public.attempts add column counted_weight numeric check (counted_weight >= 0);

create table public.game_day_counters (
  game_date date primary key references public.game_days,
  attempts integer not null default 0 check (attempts >= 0),
  passes integer not null default 0 check (passes >= 0),
  weighted_attempts numeric not null default 0 check (weighted_attempts >= 0),
  weighted_passes numeric not null default 0 check (weighted_passes >= 0),
  updated_at timestamptz not null default now(),
  constraint game_day_counters_passes_within_attempts check (passes <= attempts),
  constraint game_day_counters_weighted_passes_within_attempts check (weighted_passes <= weighted_attempts)
);

alter table public.game_day_counters enable row level security;

-- The counts are public (the live meter shows them). There are no write policies: only the
-- trigger and record_attempt_result, both running as their owner, change them.
create policy game_day_counters_select_all on public.game_day_counters
  for select to anon, authenticated
  using (true);

-- Stamps a new attempt with the player's current weight. Before insert, so it is stored in the
-- same write; it has no side effects, because a before-insert trigger runs even for an insert
-- that row-level security or a constraint will then refuse.
create or replace function public.stamp_attempt_weight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select p.weight into new.counted_weight from public.profiles p where p.id = new.user_id;
  return new;
end;
$$;

-- Counts a new attempt for its game day, after the row passed every check. The upsert is safe
-- under concurrent starts: the second insert of a new day's row turns into an update.
create or replace function public.count_started_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger attempts_stamp_weight
  before insert on public.attempts
  for each row execute function public.stamp_attempt_weight();

create trigger attempts_count_started
  after insert on public.attempts
  for each row execute function public.count_started_attempt();

-- Existing attempts (local and preview data from before this migration) are counted once here.
update public.attempts a set counted_weight = p.weight from public.profiles p where p.id = a.user_id;
insert into public.game_day_counters (game_date, attempts, passes, weighted_attempts, weighted_passes)
select game_date,
       count(*),
       count(*) filter (where passed),
       coalesce(sum(counted_weight), 0),
       coalesce(sum(counted_weight) filter (where passed), 0)
from public.attempts
group by game_date;

-- record_attempt_result now also counts a recorded pass, in the same transaction as the write.
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
  end if;
  return 'recorded';
end;
$$;

-- create or replace keeps the grants, but restate them so this file stands alone.
revoke all on function public.record_attempt_result(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result(uuid, jsonb, numeric, boolean) to service_role;
