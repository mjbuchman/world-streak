-- Trail Trace's path now climbs a 5 x 8 board in 8 to 12 tiles instead of a 5 x 10 board in 12 to
-- 18 (T207, T208), so scores under the old board are on another scale. Its pass-target percentile
-- reads only scores from the day after this runs (UTC) on (T183 pattern, T209): today's games may
-- still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'echo-path';

-- The placeholder 8 means "repeat a path of 8 tiles", the board's height (proposed, owner to confirm).
update public.game_settings set default_pass_targets = default_pass_targets || '{"echo-path": 8}';
alter table public.game_settings alter column default_pass_targets
  set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5}';

-- Coming Trail Trace games nobody has touched (day not edited, started or closed) get a target on
-- the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('echo-path', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'echo-path' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
