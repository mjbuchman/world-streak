-- Daily challenge rotation (T31): each day's challenge is its place in a settings list, counted
-- from 2027-01-01 (positive modulo, so earlier dates work too).

alter table public.game_settings
  add column rotation text[] not null default '{stacking,inner-clock,flash-count}'
  -- cardinality, not array_length: an empty array's array_length is null, which a check lets by.
  constraint game_settings_rotation_not_empty check (cardinality(rotation) >= 1);

-- A rotation may only name known challenges (a check constraint cannot read another table).
create function public.check_rotation() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unknown text;
begin
  select r into v_unknown from unnest(new.rotation) as r
   where not exists (select 1 from public.challenge_types t where t.type = r) limit 1;
  if v_unknown is not null then
    raise exception 'unknown challenge type % in the rotation', v_unknown;
  end if;
  return new;
end;
$$;

create trigger game_settings_check_rotation
  before insert or update of rotation on public.game_settings
  for each row execute function public.check_rotation();

/** The challenge the rotation gives day `d`. Public: settings are readable by everyone. */
create function public.challenge_for(d date) returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select s.rotation[(((d - date '2027-01-01') % n) + n) % n + 1]
    from public.game_settings s, lateral (select array_length(s.rotation, 1) as n) len;
$$;
grant execute on function public.challenge_for(date) to anon, authenticated;

-- ensure_game_day as in T99, with the day's challenge (and that challenge's target) from the
-- rotation. A day nobody has touched (not edited, started or closed) also follows the rotation.
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
  v_type text;
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
  v_type := public.challenge_for(d);
  v_target := public.pass_target_for(v_type, d, v_streak);
  v_threshold := least(s.default_survival_threshold + s.threshold_streak_step * v_streak, 0.95);

  if v_day.game_date is null then
    insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values (d, v_type, v_target, v_threshold)
    on conflict (game_date) do nothing;
  else
    -- Only when something changed: this runs on every attempt start.
    update public.game_days
       set challenge_type = v_type, pass_target = v_target, survival_threshold = v_threshold
     where game_date = d and not edited and closed_at is null
       and (challenge_type, pass_target, survival_threshold) is distinct from (v_type, v_target, v_threshold);
  end if;
end;
$$;
