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
-- The whole default is pinned in game_settings.test.sql; here only Second Sense's part of it.
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets') like '%"inner-clock": 0.5%',
  'a fresh settings row has its placeholder'
);

-- Below the minimum sample the target is the placeholder; a lower-better step makes it smaller.
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0.1;
select is(public.pass_target_for('inner-clock', '2000-06-01', 2), 0.3::numeric, 'with a streak of 2, the target tightens to 0.3 s');

select * from finish();
rollback;
