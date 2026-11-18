-- Swift Sum became five rounds against a 10-dot bank (T184), so its old scores (levels cleared plus
-- lives) are on another scale. Its pass-target percentile reads only scores from the day after
-- this runs (UTC) on, as Second Sense's does (T183): today's games may still be played under the
-- old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'flash-count';

-- The placeholder 5 now means "survive all five rounds" (proposed, owner to confirm).
update public.game_settings set default_pass_targets = default_pass_targets || '{"flash-count": 5}';
alter table public.game_settings alter column default_pass_targets
  set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6, "fair-split": 5}';

-- Coming Swift Sum games nobody has touched (day not edited, started or closed) get a target on
-- the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('flash-count', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'flash-count' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
