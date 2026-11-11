-- Swift Sum (Flash Count), T28: lower-better. Its score is the counting error as a percentage of
-- the true count, so a day's pass target is a largest allowed error in percent.
insert into public.challenge_types (type, direction) values ('flash-count', 'lower-better');

-- A placeholder until enough scores exist for the percentile (T22): within 15%.
update public.game_settings set default_pass_targets = default_pass_targets || '{"flash-count": 15}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 0.5, "flash-count": 15}';
