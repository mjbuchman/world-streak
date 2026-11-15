-- Second Sense plays as Time Bank (T140): its score is rounds survived plus the error budget left
-- as a fraction, so higher is better and a day's pass target is a number of rounds.
update public.challenge_types set direction = 'higher-better' where type = 'inner-clock';

-- A placeholder until enough scores exist for the percentile (T22): survive 4 rounds.
update public.game_settings set default_pass_targets = default_pass_targets || '{"inner-clock": 4}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 4, "flash-count": 15}';

-- Coming Second Sense days nobody has touched (not edited, started or closed) get a target in
-- rounds; a started day keeps its target (T102), and an edited one stays as the admin set it.
update public.game_days g
   set pass_target = public.pass_target_for('inner-clock', g.game_date, (select current from public.world_streak()))
 where g.challenge_type = 'inner-clock' and not g.edited and g.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
