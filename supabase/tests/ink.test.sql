begin;
\ir fixtures/fixtures.psql
select plan(12);

select results_eq(
  $$select direction from public.challenge_types where type = 'ink'$$,
  $$values ('higher-better')$$,
  'Confusing Colors (ink) is a higher-better challenge (T239)'
);
select is(
  (select (default_pass_targets ->> 'ink')::numeric from public.game_settings), 30::numeric,
  'its placeholder pass target is all 30 words'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets',
  '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5, "ink": 30}',
  'a fresh settings row has all six placeholders'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'ink',
  '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5}'::jsonb,
  'the other challenges keep their placeholders'
);
select ok(
  (select not 'ink' = any(pool) from public.game_settings),
  'it is not in the daily pool yet (T241)'
);

update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('ink', '2000-06-01', 0), 30::numeric, 'with too few scores, the target is the placeholder');

-- A day the lineup rule prepares still draws three games from the unchanged pool.
select public.ensure_game_day('2000-06-10');
select results_eq(
  $$select count(*)::int, count(*) filter (where challenge_type = 'ink')::int from public.game_day_games where game_date = '2000-06-10'$$,
  $$values (3, 0)$$,
  'a prepared day has three games, none of them Confusing Colors'
);

-- An admin can hand-place it into an unstarted day; a target left as it was takes the default.
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select is(public.save_game_day('2000-06-10', '{ink,stacking,fair-split}', '{30,10,5}', 0.6), true,
  'an admin places Confusing Colors into an unstarted lineup');
reset role;
select is(
  (select string_agg(challenge_type || ' ' || pass_target::float8, ', ' order by position) from public.game_day_games where game_date = '2000-06-10'),
  'ink 30, stacking 10, fair-split 5',
  'the lineup holds it with its target'
);

-- Row-level security on challenge_types is as it was: on, with the one read-only policy.
select ok((select relrowsecurity from pg_class where oid = 'public.challenge_types'::regclass), 'challenge_types keeps row-level security');
select policies_are('public', 'challenge_types', array['challenge_types_select_all'], 'it keeps its one policy');
select policy_cmd_is('public', 'challenge_types', 'challenge_types_select_all', 'select', 'and that policy only reads');

select * from finish();
rollback;
