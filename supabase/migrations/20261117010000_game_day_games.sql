-- Game-day lineups with a pass target per game (T151). game_days.challenge_type and pass_target
-- mirror the first game until the endpoints move to the lineup (T154).

create table public.game_day_games (
  game_date date not null references public.game_days on delete cascade,
  position smallint not null check (position between 1 and 3),
  challenge_type text not null references public.challenge_types,
  pass_target numeric not null check (pass_target >= 0),
  primary key (game_date, position),
  -- Deferrable, so one statement can swap two games' places (the mirror trigger below).
  constraint game_day_games_one_each unique (game_date, challenge_type) deferrable initially immediate
);

alter table public.game_day_games enable row level security;

-- Public like game_days. No write policies: only the server's functions write lineups.
create policy game_day_games_select_all on public.game_day_games
  for select to anon, authenticated
  using (true);

-- Every existing day becomes a one-game lineup; untouched open days get the full rule below.
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
select game_date, 1, challenge_type, pass_target from public.game_days;

/** Day `d`'s games in order, or null when it has none. */
create function public.lineup_of(d date) returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select array_agg(challenge_type order by position) from public.game_day_games where game_date = d;
$$;
grant execute on function public.lineup_of(date) to anon, authenticated;

-- The first game the lineup rule gives day `d` (what /play shows before the day exists).
create or replace function public.challenge_for(d date) returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select (public.lineup_for(d, public.lineup_of(d - 1)))[1];
$$;

-- An edit of game_days' challenge or target (the admin editor and local tools, until T161) moves
-- to the first game; the game it brings forward swaps places with the old first game, each
-- keeping its own target.
create function public.mirror_first_game() returns trigger
language plpgsql
-- Definer: lineups have no client write policies, and an admin edits game_days directly.
security definer
set search_path = ''
as $$
begin
  update public.game_day_games g
     set challenge_type = case when g.position = 1 then new.challenge_type else f.challenge_type end,
         pass_target = case when g.position = 1 then new.pass_target else f.pass_target end
    from public.game_day_games f
   where f.game_date = new.game_date and f.position = 1
     and g.game_date = new.game_date and (g.position = 1 or g.challenge_type = new.challenge_type);
  return null;
end;
$$;
revoke execute on function public.mirror_first_game() from public, anon, authenticated;

create trigger game_days_mirror_first_game
  after update of challenge_type, pass_target on public.game_days
  for each row
  when ((new.challenge_type, new.pass_target) is distinct from (old.challenge_type, old.pass_target))
  execute function public.mirror_first_game();

-- ensure_game_day as in T31, with a lineup: three games by the rule (the day before's lineup as
-- `previous`), each with its own target. A day nobody has touched (not edited, started or
-- closed) follows the rule and the settings again on each call, as the rotation's days did
-- (T102); any other day's lineup is never overwritten.
create or replace function public.ensure_game_day(d date)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  s public.game_settings;
  v_day public.game_days;
  v_streak integer;
  v_lineup text[];
  v_targets numeric[];
  v_threshold numeric;
begin
  -- Locked, so a start counting itself (it holds a share lock on the day) finishes first and is
  -- seen below, rather than starting just before the target changes.
  select * into v_day from public.game_days where game_date = d for update;
  if found and (v_day.edited or v_day.closed_at is not null
                or exists (select 1 from public.attempts where game_date = d)) then
    return;
  end if;

  select * into s from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  select current into v_streak from public.world_streak();
  v_lineup := public.lineup_for(d, public.lineup_of(d - 1));
  select array_agg(public.pass_target_for(t, d, v_streak) order by n) into v_targets
    from unnest(v_lineup) with ordinality as u(t, n);
  v_threshold := least(s.default_survival_threshold + s.threshold_streak_step * v_streak, 0.95);

  if v_day.game_date is null then
    insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values (d, v_lineup[1], v_targets[1], v_threshold)
    on conflict (game_date) do nothing;
  else
    -- Only when something changed: this runs on every attempt start.
    update public.game_days
       set challenge_type = v_lineup[1], pass_target = v_targets[1], survival_threshold = v_threshold
     where game_date = d
       and (challenge_type, pass_target, survival_threshold) is distinct from (v_lineup[1], v_targets[1], v_threshold);
  end if;

  if (select array_agg(array[challenge_type, pass_target::text] order by position)
        from public.game_day_games where game_date = d)
     is distinct from
     (select array_agg(array[t, v_targets[n]::text] order by n) from unnest(v_lineup) with ordinality as u(t, n)) then
    delete from public.game_day_games where game_date = d;
    insert into public.game_day_games (game_date, position, challenge_type, pass_target)
    select d, n, t, v_targets[n] from unnest(v_lineup) with ordinality as u(t, n);
  end if;
end;
$$;

-- Untouched open days get their full lineup now rather than at their next start.
select public.ensure_game_day(game_date) from public.game_days where closed_at is null order by game_date;
