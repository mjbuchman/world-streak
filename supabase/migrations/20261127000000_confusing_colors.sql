-- Confusing Colors, code name `ink` (T239): its score is the words survived plus the bank left as a
-- fraction, so higher is better and a day's pass target is a number of words. Not in the daily pool
-- until T241; an admin can still place it in a lineup by hand.
insert into public.challenge_types (type, direction) values ('ink', 'higher-better');

-- A placeholder until enough scores exist for the percentile (T22): survive all 30 words.
-- No WHERE clause: game_settings holds a single row.
update public.game_settings set default_pass_targets = default_pass_targets || '{"ink": 30}';
alter table public.game_settings alter column default_pass_targets
  set default '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5, "ink": 30}';
