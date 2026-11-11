-- Second Sense (Inner Clock), T26: the first lower-better challenge. Its score is how far off the
-- tap was, in seconds, so a day's pass target is a largest allowed error.
insert into public.challenge_types (type, direction) values ('inner-clock', 'lower-better');

-- A placeholder until enough scores exist for the percentile (T22): within half a second.
update public.game_settings set default_pass_targets = default_pass_targets || '{"inner-clock": 0.5}';
alter table public.game_settings alter column default_pass_targets set default '{"stacking": 10, "inner-clock": 0.5}';
