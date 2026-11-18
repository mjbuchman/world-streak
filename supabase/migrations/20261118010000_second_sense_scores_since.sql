-- Second Sense became four 15 to 25 s rounds against a 10 s bank (T181), so its old scores (up to
-- 8 rounds plus a fraction) are on another scale. A challenge's pass-target percentile now reads
-- only scores from its `scores_since` date on (T183); null means every score counts.
alter table public.challenge_types add column scores_since date;

-- From the day after this runs (UTC): today's games may still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'inner-clock';

-- The placeholder stays 4, now meaning "survive all four rounds" (proposed, owner to confirm).
update public.game_settings set default_pass_targets = default_pass_targets || '{"inner-clock": 4}';
alter table public.game_settings alter column default_pass_targets
  set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6, "fair-split": 5}';

-- pass_target_for as in T152, over attempts on or after the challenge's scores_since.
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
  v_since date;
  v_count integer;
  v_base numeric;
  v_step numeric;
begin
  select * into s from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  select direction, scores_since into v_direction, v_since from public.challenge_types where type = challenge;
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
  from public.attempts a
  where a.challenge_type = challenge
    and a.submitted_at is not null and a.score is not null
    and a.game_date between d - s.percentile_lookback_days and d - 1
    and (v_since is null or a.game_date >= v_since)
    and (select greatest(count(*) filter (where e.passed), count(*) filter (where e.passed is not true)) * 2
           from public.attempts e
          where e.user_id = a.user_id and e.game_date = a.game_date and e.position < a.position)
        <= (select count(*) from public.game_day_games g where g.game_date = a.game_date);

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

-- Coming Second Sense games nobody has touched (day not edited, started or closed) get a target
-- on the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('inner-clock', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'inner-clock' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
