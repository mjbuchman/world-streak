-- Swift Sum now draws 10 to 30 dots every round instead of a rising 6 to 23 (T205), so scores
-- under the old counts are on another scale. Its pass-target percentile reads only scores from the
-- day after this runs (UTC) on (T183 pattern, T206): today's games may still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'flash-count';

-- The bank stays at 10 dots (T205's simulation), so the placeholder 5 still means "survive all five rounds".
update public.game_settings set default_pass_targets = default_pass_targets || '{"flash-count": 5}';

-- Coming Swift Sum games nobody has touched (day not edited, started or closed) get a target on the
-- new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('flash-count', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'flash-count' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
