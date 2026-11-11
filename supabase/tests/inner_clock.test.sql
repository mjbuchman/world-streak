begin;
select plan(4);

select results_eq(
  $$select direction from public.challenge_types where type = 'inner-clock'$$,
  $$values ('lower-better')$$,
  'Second Sense is a lower-better challenge'
);
select is(
  (select (default_pass_targets ->> 'inner-clock')::numeric from public.game_settings), 0.5::numeric,
  'its placeholder pass target is half a second'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 0.5}',
  'a fresh settings row has both placeholders'
);

-- Below the minimum sample the target is the placeholder; a lower-better step makes it smaller.
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0.1;
select is(public.pass_target_for('inner-clock', '2000-06-01', 2), 0.3::numeric, 'with a streak of 2, the target tightens to 0.3 s');

select * from finish();
rollback;
