-- Fair Split (T149): its score is the shapes cut plus the lives left as a fraction, so higher is
-- better and a day's pass target is a number of shapes. Not in the rotation until T150.
insert into public.challenge_types (type, direction) values ('fair-split', 'higher-better');

-- A placeholder until enough scores exist for the percentile (T22): cut 5 shapes.
-- No WHERE clause: game_settings holds a single row.
update public.game_settings set default_pass_targets = default_pass_targets || '{"fair-split": 5}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6, "fair-split": 5}';
