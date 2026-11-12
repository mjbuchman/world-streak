-- Postgres numeric accepts 'NaN' and 'Infinity', and both pass `>= 0` (NaN sorts above every
-- number). The streak steps must be finite, like every other setting (T89).
alter table public.game_settings
  drop constraint game_settings_pass_target_streak_step_check,
  add constraint game_settings_pass_target_streak_step_check
    check (pass_target_streak_step >= 0 and pass_target_streak_step < 'Infinity'),
  drop constraint game_settings_threshold_streak_step_check,
  add constraint game_settings_threshold_streak_step_check
    check (threshold_streak_step >= 0 and threshold_streak_step < 'Infinity');
