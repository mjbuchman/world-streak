begin;
select plan(4);

select results_eq(
  $$select direction from public.challenge_types where type = 'flash-count'$$,
  $$values ('lower-better')$$,
  'Swift Sum is a lower-better challenge'
);
select is(
  (select (default_pass_targets ->> 'flash-count')::numeric from public.game_settings), 15::numeric,
  'its placeholder pass target is a 15% error'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 0.5, "flash-count": 15}',
  'a fresh settings row has all three placeholders'
);

-- Below the minimum sample the target is the placeholder.
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('flash-count', '2000-06-01', 0), 15::numeric, 'with too few scores, the target is the placeholder');

select * from finish();
rollback;
