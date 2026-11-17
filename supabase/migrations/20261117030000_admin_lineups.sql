-- Admin lineup edits (T161). An admin sets an open day's three games and their order until anyone
-- starts the day, and each game's pass target until that game has an attempt. The editor no
-- longer writes game_days.challenge_type or pass_target; nothing reads them now, and they are
-- dropped once the local tools stop writing them (T174).

grant update (challenge_type, pass_target) on public.game_day_games to authenticated;

create policy game_day_games_update_admin_open on public.game_day_games
  for update to authenticated
  using ((select public.is_admin())
         and exists (select 1 from public.game_days d where d.game_date = game_day_games.game_date and d.closed_at is null))
  with check ((select public.is_admin())
              and exists (select 1 from public.game_days d where d.game_date = game_day_games.game_date and d.closed_at is null));

-- The locks, for everyone (admins and the service role alike): SQLSTATE WS003 for a game change on
-- a started day, WS002 for a started game's target. Like T111, a game change that leaves the
-- slot's target as it was gives the new game its default target (one game's target means nothing
-- for another).
create function public.edit_day_game() returns trigger
language plpgsql
-- Definer: an admin's row-level security shows only their own attempts, and the checks must see
-- all; pass_target_for is also service-role only.
security definer
set search_path = ''
as $$
declare
  v_streak integer;
begin
  -- An attempt start share-locks the day row first, so it and this edit never interleave.
  perform 1 from public.game_days where game_date = old.game_date for update;
  if new.challenge_type is distinct from old.challenge_type then
    if exists (select 1 from public.attempts where game_date = old.game_date) then
      raise exception 'game day % has started, so its lineup is locked', old.game_date using errcode = 'WS003';
    end if;
    -- Not under another trigger: mirror_first_game sets both columns itself.
    if new.pass_target is not distinct from old.pass_target and pg_trigger_depth() = 1 then
      select current into v_streak from public.world_streak();
      new.pass_target := public.pass_target_for(new.challenge_type, new.game_date, v_streak);
    end if;
  end if;
  if new.pass_target is distinct from old.pass_target
     and exists (select 1 from public.attempts where game_date = old.game_date and position = old.position) then
    raise exception 'game % of game day % has started, so its pass target is locked', old.position, old.game_date
      using errcode = 'WS002';
  end if;
  return new;
end;
$$;
revoke execute on function public.edit_day_game() from public, anon, authenticated;

create trigger game_day_games_edit
  before update of challenge_type, pass_target on public.game_day_games
  for each row execute function public.edit_day_game();

/**
 * An admin's save of open day `d`: its games in order, each game's target and the day's survival
 * threshold, marking the day edited so the lineup rule leaves it alone. Runs as the caller, so the
 * policies decide; false when no open day changed (closed, unknown, or the caller is no admin).
 */
create function public.save_game_day(d date, games text[], targets numeric[], threshold numeric) returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if cardinality(games) is distinct from 3 or cardinality(targets) is distinct from 3 then
    raise exception 'a lineup has three games, each with a target' using errcode = '22023';
  end if;
  -- The day first, so it is locked before its games, in the order an attempt start takes them.
  update public.game_days set survival_threshold = threshold, edited = true where game_date = d and closed_at is null;
  if not found then
    return false;
  end if;
  -- A new order briefly has a game in two places; the check waits for the end of the transaction.
  set constraints public.game_day_games_one_each deferred;
  update public.game_day_games g
     set challenge_type = games[g.position], pass_target = targets[g.position]
   where g.game_date = d
     and (g.challenge_type, g.pass_target) is distinct from (games[g.position], targets[g.position]);
  return true;
end;
$$;
revoke execute on function public.save_game_day(date, text[], numeric[], numeric) from public, anon;
grant execute on function public.save_game_day(date, text[], numeric[], numeric) to authenticated;

/** The games with at least one attempt between two days, for the admin page (service role only). */
create function public.started_games(first_day date, last_day date)
returns table (game_date date, game_position smallint)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct a.game_date, a.position from public.attempts a where a.game_date between first_day and last_day;
$$;
revoke execute on function public.started_games(date, date) from public, anon, authenticated;
grant execute on function public.started_games(date, date) to service_role;
