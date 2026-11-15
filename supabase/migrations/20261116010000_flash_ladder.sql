-- Swift Sum plays as Flash Ladder (T142): its score is levels cleared plus the lives left as a
-- fraction, so higher is better and a day's pass target is a number of levels.
update public.challenge_types set direction = 'higher-better' where type = 'flash-count';

-- A placeholder until enough scores exist for the percentile (T22): clear 5 levels.
update public.game_settings set default_pass_targets = default_pass_targets || '{"flash-count": 5}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5}';

-- Coming Swift Sum days nobody has touched (not edited, started or closed) get a target in
-- levels; a started day keeps its target (T102), and an edited one stays as the admin set it.
update public.game_days g
   set pass_target = public.pass_target_for('flash-count', g.game_date, (select current from public.world_streak()))
 where g.challenge_type = 'flash-count' and not g.edited and g.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
