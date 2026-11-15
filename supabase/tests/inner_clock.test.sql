begin;
select plan(6);

select results_eq(
  $$select direction from public.challenge_types where type = 'inner-clock'$$,
  $$values ('higher-better')$$,
  'Second Sense: Time Bank is a higher-better challenge (T140)'
);
select is(
  (select (default_pass_targets ->> 'inner-clock')::numeric from public.game_settings), 4::numeric,
  'its placeholder pass target is 4 rounds'
);
-- The whole default is pinned in game_settings.test.sql; here only Second Sense's part of it.
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets') like '%"inner-clock": 4%',
  'a fresh settings row has its placeholder'
);

-- Below the minimum sample the target is the placeholder; a higher-better step makes it bigger.
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0.5;
select is(public.pass_target_for('inner-clock', '2000-06-01', 2), 5::numeric, 'with a streak of 2, the target rises to 5 rounds');

-- An untouched coming day still holding a target from the single-round game follows the new
-- placeholder; an edited one keeps the admin's value.
update public.game_settings set pass_target_streak_step = 0, rotation = '{inner-clock}';
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, edited)
values ('2000-06-02', 'inner-clock', 0.5, 0.6, false), ('2000-06-03', 'inner-clock', 0.5, 0.6, true);
select public.ensure_game_day('2000-06-02');
select public.ensure_game_day('2000-06-03');
select is((select pass_target from public.game_days where game_date = '2000-06-02'), 4::numeric, 'an untouched day gets the target in rounds');
select is((select pass_target from public.game_days where game_date = '2000-06-03'), 0.5::numeric, 'an edited day keeps its target');

select * from finish();
rollback;
