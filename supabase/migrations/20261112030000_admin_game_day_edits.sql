-- Admin edits to game days (T99): an admin may change an open day's pass target and survival
-- threshold, and a day an admin has not edited keeps following the settings until it starts.

-- Set by the admin editor, so the automatic preparation leaves that day alone from then on.
alter table public.game_days add column edited boolean not null default false;

-- Players and visitors could already not update game days (no policy). Narrow the privilege
-- itself to the three columns an admin edit writes, and allow it only to admins on open days.
revoke update on public.game_days from anon, authenticated;
grant update (pass_target, survival_threshold, edited) on public.game_days to authenticated;

create policy game_days_update_admin_open on public.game_days
  for update to authenticated
  using ((select public.is_admin()) and closed_at is null)
  with check ((select public.is_admin()) and closed_at is null and edited);

-- ensure_game_day as in T22, but it also refreshes a day that already exists when nobody has
-- touched it yet: not edited by an admin, not started by anyone, not closed. So a day created
-- early (by /admin, T25) still gets the streak and recent scores as they stand at the close
-- before it, and once anyone has started it, its target never moves under them.
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
  v_target numeric;
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
  v_target := public.pass_target_for('stacking', d, v_streak);
  v_threshold := least(s.default_survival_threshold + s.threshold_streak_step * v_streak, 0.95);

  if v_day.game_date is null then
    insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values (d, 'stacking', v_target, v_threshold)
    on conflict (game_date) do nothing;
  else
    update public.game_days set pass_target = v_target, survival_threshold = v_threshold
    where game_date = d and not edited and closed_at is null;
  end if;
end;
$$;
