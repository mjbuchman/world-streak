begin;
\ir fixtures/fixtures.psql
select plan(6);

select results_eq(
  $$select direction from public.challenge_types where type = 'fair-split'$$,
  $$values ('higher-better')$$,
  'Fair Split is a higher-better challenge (T149)'
);
select is(
  (select (default_pass_targets ->> 'fair-split')::numeric from public.game_settings), 5::numeric,
  'its placeholder pass target is 5 shapes'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5}',
  'a fresh settings row has all five placeholders'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'fair-split',
  '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8}'::jsonb,
  'the other challenges keep their placeholders'
);
select ok(
  (select 'fair-split' = any(pool) from public.game_settings),
  'it is in the daily pool (T150)'
);

update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('fair-split', '2000-06-01', 0), 5::numeric, 'with too few scores, the target is the placeholder');
-- The re-target the T212 and T223 migrations ran is tested once, in scores_since.test.sql.

select * from finish();
rollback;
