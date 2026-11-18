-- game_days.challenge_type and pass_target mirrored a day's first game until the lineups took over
-- (T151–T163). Nothing reads or writes them now (T174), so they go, with the triggers that kept
-- them in step or locked them; game_day_games' own trigger (edit_day_game) locks started games.

drop trigger game_days_mirror_first_game on public.game_days;
drop function public.mirror_first_game();
drop trigger game_days_change_challenge on public.game_days;
drop function public.change_day_challenge();
drop trigger game_days_lock_started_pass_target on public.game_days;
drop function public.lock_started_pass_target();
-- A day inserted directly (tests and local tools) now writes its own lineup rows.
drop trigger game_days_add_first_game on public.game_days;
drop function public.add_first_game();

-- ensure_game_day as in T151, without the two columns.
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
    insert into public.game_days (game_date, survival_threshold)
    values (d, v_threshold)
    on conflict (game_date) do nothing;
  elsif v_day.survival_threshold is distinct from v_threshold then
    -- Only when something changed: this runs on every attempt start.
    update public.game_days set survival_threshold = v_threshold where game_date = d;
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

alter table public.game_days drop column challenge_type, drop column pass_target;
