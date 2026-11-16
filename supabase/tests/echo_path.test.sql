begin;
select plan(5);

select results_eq(
  $$select direction from public.challenge_types where type = 'echo-path'$$,
  $$values ('higher-better')$$,
  'Echo Path is a higher-better challenge (T145)'
);
select is(
  (select (default_pass_targets ->> 'echo-path')::numeric from public.game_settings), 6::numeric,
  'its placeholder pass target is a path of 6'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6, "fair-split": 5}',
  'a fresh settings row has its placeholder (and those added since)'
);
select is(
  (select rotation from public.game_settings), '{stacking,inner-clock,flash-count}'::text[],
  'it is not in the daily rotation yet (T150)'
);

update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('echo-path', '2000-06-01', 0), 6::numeric, 'with too few scores, the target is the placeholder');

select * from finish();
rollback;
