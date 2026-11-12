begin;
select plan(6);
-- These tests prepare Tower days; the rotation (T31) has its own tests in rotation.test.sql.
update public.game_settings set rotation = '{stacking}';

-- Fixtures: an admin and a player, two open days (one started below), no streak.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, default_pass_targets = '{"stacking": 10}';
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
select public.ensure_game_day('2000-05-10');
select public.ensure_game_day('2000-05-11');
select tests.start('00000000-0000-0000-0000-0000000005b0', '00000000-0000-0000-0000-0000000000b0', '2000-05-11', 1);

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.game_days set pass_target = 12, edited = true where game_date = '2000-05-10'$$,
  'before anyone starts, the pass target can change'
);
select throws_ok(
  $$update public.game_days set pass_target = 12, edited = true where game_date = '2000-05-11'$$,
  'WS002', 'game day 2000-05-11 has started, so its pass target is locked',
  'once a player has started, the pass target cannot change'
);
select lives_ok(
  $$update public.game_days set survival_threshold = 0.5, edited = true where game_date = '2000-05-11'$$,
  'the threshold of a started day can still change'
);
select lives_ok(
  $$update public.game_days set pass_target = 10, survival_threshold = 0.45, edited = true where game_date = '2000-05-11'$$,
  'and a save that repeats the unchanged target goes through'
);
reset role;

-- Not only admins: the lock is on the table, so the service role cannot move it either.
set local role service_role;
select throws_ok(
  $$update public.game_days set pass_target = 3 where game_date = '2000-05-11'$$,
  'WS002', null, 'the service role cannot change a started day''s pass target'
);
reset role;

select results_eq(
  $$select game_date, pass_target, survival_threshold from public.game_days where game_date in ('2000-05-10', '2000-05-11') order by game_date$$,
  $$values ('2000-05-10'::date, 12::numeric, 0.60::numeric), ('2000-05-11'::date, 10::numeric, 0.45::numeric)$$,
  'the unstarted day took the new target; the started day kept its target and took the threshold'
);

select * from finish();
rollback;
