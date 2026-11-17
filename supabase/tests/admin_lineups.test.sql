begin;
select plan(19);

-- Fixtures: an admin and a player; a closed, an unstarted and a started day (games 1 and 2 begun),
-- each the lineup Tower 10, Second Sense 0.5, Swift Sum 20; no streak, default targets only.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0,
  default_pass_targets = '{"stacking": 10, "inner-clock": 0.5, "flash-count": 20, "echo-path": 6, "fair-split": 5}';
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
select public.ensure_game_day(d) from (values ('2000-06-09'::date), ('2000-06-10'), ('2000-06-11')) as days(d);
delete from public.game_day_games where game_date between '2000-06-09' and '2000-06-11';
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
select d, p, g, t
  from (values ('2000-06-09'::date), ('2000-06-10'), ('2000-06-11')) as days(d),
       (values (1, 'stacking', 10), (2, 'inner-clock', 0.5), (3, 'flash-count', 20)) as games(p, g, t);
update public.game_days set closed_at = now(), outcome = 'broken' where game_date = '2000-06-09';
select tests.start('00000000-0000-0000-0000-0000000006b0', '00000000-0000-0000-0000-0000000000b0', '2000-06-11', 1);
insert into public.attempts (user_id, game_date, seed, position) values ('00000000-0000-0000-0000-0000000000b0', '2000-06-11', 2, 2);

create function tests.lineup(d date) returns text language sql as $$
  select string_agg(challenge_type || ' ' || pass_target::float8, ', ' order by position)
    from public.game_day_games where game_date = d;
$$;

-- Readable by the test roles below (rolled back with the rest).
grant usage on schema tests to authenticated;

select ok(
  exists (select 1 from pg_policies where tablename = 'game_day_games' and policyname = 'game_day_games_update_admin_open' and cmd = 'UPDATE'),
  'admins have an update policy on the lineups'
);

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
-- Game 1 changes with its target left as it was; games 2 and 3 move up with new targets.
select is(public.save_game_day('2000-06-10', '{echo-path,stacking,inner-clock}', '{10,10,0.5}', 0.55), true,
  'an admin saves an unstarted day''s new lineup');
select is(tests.lineup('2000-06-10'), 'echo-path 6, stacking 10, inner-clock 0.5',
  'the games move to their new places, and a new game whose target was left as it was takes its default');
select lives_ok('set constraints all immediate', 'a reorder leaves each game in one place');
select results_eq(
  $$select survival_threshold, edited from public.game_days where game_date = '2000-06-10'$$,
  $$values (0.55::numeric, true)$$,
  'the threshold is saved and the day marked edited'
);

savepoint repeated;
select public.save_game_day('2000-06-10', '{stacking,stacking,inner-clock}', '{10,10,0.5}', 0.55);
select throws_ok('set constraints all immediate', '23505', null, 'a lineup cannot name a game twice');
rollback to savepoint repeated;

select throws_ok(
  $$select public.save_game_day('2000-06-11', '{echo-path,inner-clock,flash-count}', '{10,0.5,20}', 0.6)$$,
  'WS003', 'game day 2000-06-11 has started, so its lineup is locked',
  'once a player has started the day, its games cannot change'
);
select throws_ok(
  $$select public.save_game_day('2000-06-11', '{stacking,inner-clock,flash-count}', '{10,0.8,20}', 0.6)$$,
  'WS002', 'game 2 of game day 2000-06-11 has started, so its pass target is locked',
  'a started game''s target cannot change'
);
select is(public.save_game_day('2000-06-11', '{stacking,inner-clock,flash-count}', '{10,0.5,25}', 0.5), true,
  'an unstarted game''s target still can');
select is(tests.lineup('2000-06-11'), 'stacking 10, inner-clock 0.5, flash-count 25', 'only that target changed');
select is(public.save_game_day('2000-06-09', '{echo-path,inner-clock,flash-count}', '{6,0.5,20}', 0.5), false,
  'a closed day does not change');
select throws_ok(
  $$select public.save_game_day('2000-06-10', '{stacking,inner-clock}', '{10,0.5}', 0.5)$$,
  '22023', 'a lineup has three games, each with a target', 'a lineup has exactly three games'
);
reset role;
select is(tests.lineup('2000-06-09'), 'stacking 10, inner-clock 0.5, flash-count 20', 'the closed day kept its lineup');

-- As a player: neither the save nor a direct update changes anything.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
set local role authenticated;
select is(public.save_game_day('2000-06-10', '{fair-split,stacking,inner-clock}', '{5,10,0.5}', 0.9), false, 'a player''s save does nothing');
update public.game_day_games set pass_target = 1 where game_date = '2000-06-10';
select throws_ok($$select * from public.started_games('2000-06-09', '2000-06-11')$$, '42501', null, 'players cannot list started games');
reset role;
select is(tests.lineup('2000-06-10'), 'echo-path 6, stacking 10, inner-clock 0.5', 'a player''s direct update does nothing either');

-- The edited day keeps its lineup when the automatic preparation runs again.
select public.ensure_game_day('2000-06-10');
select is(tests.lineup('2000-06-10'), 'echo-path 6, stacking 10, inner-clock 0.5', 'the lineup rule leaves the edited day alone');

-- The locks are on the table, so the service role cannot get past them either.
set local role service_role;
select throws_ok(
  $$update public.game_day_games set challenge_type = 'fair-split' where game_date = '2000-06-11' and position = 3$$,
  'WS003', null, 'the service role cannot change a started day''s games'
);
select results_eq(
  $$select game_date, game_position from public.started_games('2000-06-09', '2000-06-11') order by 1, 2$$,
  $$values ('2000-06-11'::date, 1::smallint), ('2000-06-11'::date, 2::smallint)$$,
  'the started games, for the admin page'
);
reset role;

select * from finish();
rollback;
