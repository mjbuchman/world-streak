-- Echo Path (T145): its score is the longest path repeated plus the lives left as a fraction, so
-- higher is better and a day's pass target is a path length. Not in the rotation until T150.
insert into public.challenge_types (type, direction) values ('echo-path', 'higher-better');

-- A placeholder until enough scores exist for the percentile (T22): repeat a path of 6.
update public.game_settings set default_pass_targets = default_pass_targets || '{"echo-path": 6}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6}';
