-- Prize-draw entries (T35): one per passed game day inside a cycle. Preseason passes earn none.

create table public.entries (
  id bigint generated always as identity primary key,
  -- An entry goes with its attempt (the local tools clear attempts) and its player, as attempts do.
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  cycle_number integer not null references public.cycles (number),
  game_date date not null references public.game_days (game_date),
  created_at timestamptz not null default now(),
  -- One scored attempt per day already holds; this keeps the draw safe even so.
  constraint entries_one_per_day unique (user_id, game_date)
);
create index entries_cycle on public.entries (cycle_number);

-- Players read only their own entries. No client writes: record_attempt_result adds them.
alter table public.entries enable row level security;
create policy entries_select_own on public.entries
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.entries from anon, authenticated;
grant select on public.entries to authenticated;

/** The caller's entries in `cycle` (0 when signed out). */
create function public.my_entry_count(cycle integer) returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.entries where cycle_number = cycle and user_id = (select auth.uid());
$$;
revoke all on function public.my_entry_count(integer) from public, anon;
grant execute on function public.my_entry_count(integer) to authenticated;

-- record_attempt_result as in T93, plus the entry for a pass inside a cycle.
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

    v_cycle := public.cycle_for(v_game_date);
    if v_cycle is not null then
      insert into public.entries (attempt_id, user_id, cycle_number, game_date)
      values (p_attempt_id, v_user_id, v_cycle, v_game_date);
    end if;
  end if;
  return 'recorded';
end;
$$;

-- create or replace keeps the grants, but restate them so this file stands alone.
revoke all on function public.record_attempt_result(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result(uuid, jsonb, numeric, boolean) to service_role;
