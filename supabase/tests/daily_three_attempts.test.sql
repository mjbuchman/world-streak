begin;
select plan(43);
\ir fixtures/fixtures.psql

-- One scored attempt per game (T152).
select col_not_null('public', 'attempts', 'position', 'every attempt has a position');
select col_not_null('public', 'attempts', 'challenge_type', 'and a game');
select col_is_unique('public', 'attempts', array['user_id', 'game_date', 'position'], 'one attempt per game position');
select col_is_unique('public', 'attempts', array['user_id', 'game_date', 'challenge_type'], 'one attempt per game');
select ok(not exists (select 1 from pg_constraint where conname = 'attempts_user_id_game_date_key'), 'the one-a-day constraint is gone');

-- A day with a fixed lineup, every game higher-better: Tower 10, Swift Sum 5, Fair Split 5. Days
-- before it are closed so it can close in order; cycle 1 covers it so passes earn entries.
update public.game_settings set percentile_min_sample = 3, percentile_lookback_days = 14, pass_target_percentile = 0.8,
  pass_target_streak_step = 0, threshold_streak_step = 0, default_pass_targets = default_pass_targets || '{"flash-count": 5, "fair-split": 5}';
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2032-05-01';
delete from public.game_days where game_date > '2032-05-01';
update public.cycles set start_date = '2032-04-30', end_date = '2032-06-28' where number = 1;
select public.ensure_game_day('2032-05-01');
update public.game_days set survival_threshold = 0.6, edited = true where game_date = '2032-05-01';
delete from public.game_day_games where game_date = '2032-05-01';
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
values ('2032-05-01', 1, 'stacking', 10), ('2032-05-01', 2, 'flash-count', 5), ('2032-05-01', 3, 'fair-split', 5);

create function tests.p(n integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000005' || lpad(n::text, 2, '0'))::uuid;
$$;
create function tests.a(n integer, pos integer) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-000000006' || lpad(n::text, 2, '0') || pos)::uuid;
$$;
create function tests.start_game(n integer, pos integer) returns uuid language sql as $$
  insert into public.attempts (id, user_id, game_date, seed, position)
  values (tests.a(n, pos), tests.p(n), '2032-05-01', pos, pos) returning id;
$$;
-- Records a score with the pass the game's own target gives.
create function tests.submit(n integer, pos integer, score numeric) returns text language sql as $$
  select public.record_attempt_result_unchecked(tests.a(n, pos), '{}', score,
    score >= (select pass_target from public.game_day_games where game_date = '2032-05-01' and position = pos));
$$;
create function tests.play(n integer, pos integer, score numeric) returns text language sql as $$
  select tests.start_game(n, pos);
  select tests.submit(n, pos, score);
$$;
-- A player's day as "wins losses outcome".
create function tests.day(n integer) returns text language sql as $$
  select concat_ws(' ', wins, losses, coalesce(outcome, 'open')) from public.day_results
   where user_id = tests.p(n) and game_date = '2032-05-01';
$$;
create function tests.counts() returns text language sql as $$
  select concat_ws(' ', completed_days, passed_days, weighted_completed_days, weighted_passed_days)
    from public.game_day_counters where game_date = '2032-05-01';
$$;

select tests.make_player(tests.p(n)) from generate_series(1, 4) n;
select tests.make_player(tests.p(5), 0.5);
select tests.make_player(tests.p(6));

select tests.start_game(1, 1);
select is((select challenge_type from public.attempts where id = tests.a(1, 1)), 'stacking', 'an attempt takes its game from the lineup');
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed, position) values (tests.p(1), '2032-05-01', 9, 1)$$,
  '23505', null, 'a second attempt at the same game is a unique violation'
);
select throws_ok($$select tests.start_game(1, 3)$$, 'WS004', null, 'starting game 3 before game 2 is refused');
select throws_ok(
  $$select public.record_attempt_result_unchecked(tests.a(1, 1), '{}', 9, true)$$,
  'WS005', null, 'a pass the game''s target does not give is refused'
);

-- Day results (T153). Player 1: win, win (decided after two games), then a third game that changes nothing.
select is(tests.submit(1, 1, 12), 'recorded', 'setup: player 1 wins game 1');
select is(tests.day(1), '1 0 open', 'one win of three decides nothing');
select is(tests.play(1, 2, 7), 'recorded', 'setup: player 1 wins game 2');
select is(tests.day(1), '2 0 passed', 'two wins pass the day');
select is((select passed from public.attempts where id = tests.a(1, 2)), true, 'game 2 passed against its own target (7 >= 5)');
select tests.start_game(1, 3);
select is(tests.day(1), '2 1 passed', 'the third game, started, counts as a loss but the day stays passed');
select is(tests.submit(1, 3, 2), 'recorded', 'setup: player 1 loses game 3');
select is(tests.day(1), '2 1 passed', 'and stays passed once it is recorded');
select is((select count(*)::int from public.attempts where user_id = tests.p(1)), 3, 'three attempts at the three games go in');

-- Player 2: loss, win, loss.
select tests.play(2, 1, 3);
select is(tests.day(2), '0 1 open', 'a loss on game 1 decides nothing');
select tests.play(2, 2, 8);
select tests.play(2, 3, 1);
select is(tests.day(2), '1 2 failed', 'loss, win, loss fails the day');

-- Player 3: loses game 1, starts game 2 and leaves.
select tests.play(3, 1, 3);
select tests.start_game(3, 2);
select is(tests.day(3), '0 2 failed', 'an abandoned game 2 after a loss fails the day');
select tests.play(3, 3, 6);
select is(tests.day(3), '1 2 failed', 'and a pass on game 3 leaves it failed');

-- Player 4: a loss, then passes on games 2 and 3. Starting game 2 is a provisional second loss.
select tests.play(4, 1, 3);
select tests.counts() as before_four \gset
select tests.start_game(4, 2);
select is(tests.day(4), '0 2 failed', 'while game 2 is open the day counts as failed');
select tests.submit(4, 2, 6);
select is(tests.day(4), '1 1 open', 'its pass reopens the day');
select is(tests.counts(), :'before_four', 'so the counters drop the provisional fail');
select tests.play(4, 3, 6);
select is(tests.day(4), '2 1 passed', 'the pass on game 3 passes the day');

-- Player 5 (weight 0.5): win, win. Player 6 loses game 1 and never comes back.
select tests.play(5, 1, 12);
select tests.play(5, 2, 9);
select tests.play(6, 1, 3);
select is(tests.day(6), '0 1 open', 'one loss is not a completed day');

select is(tests.counts(), '5 3 4.5 2.5', 'five completed days (players 1-5), three passed, player 5 at half weight');
select results_eq(
  $$select user_id, attempt_id from public.entries where game_date = '2032-05-01' order by user_id$$,
  $$values (tests.p(1), tests.a(1, 2)), (tests.p(4), tests.a(4, 3)), (tests.p(5), tests.a(5, 2))$$,
  'one entry per passed day, for the game that passed it'
);

-- Each game's percentile reads only that game's attempts, and leaves out games played after the
-- day was decided: Swift Sum scored 7, 8, 6, 9 (its 80th percentile is 6); Fair Split keeps 1 and
-- 6 but not player 1's 2, too few for a percentile, so it keeps its default.
select is(public.pass_target_for('flash-count', '2032-05-02', 0), 6::numeric, 'Swift Sum''s target comes from its own scores');
select is(public.pass_target_for('fair-split', '2032-05-02', 0), 5::numeric, 'a game played after the day was decided is left out');
select is(public.pass_target_for('stacking', '2032-05-02', 0), 3::numeric, 'the Tower''s from its own six scores');

-- Deleting an attempt (the local tools) rebuilds the day result; a recount agrees with the counters.
select tests.counts() as live \gset
delete from public.attempts where id = tests.a(6, 1);
select is(tests.day(6), null, 'a player with no attempts left has no day result');
select public.recount_game_day('2032-05-01');
select is(tests.counts(), :'live', 'a recount gives the same completed-day counters');

-- The close uses passed days over completed days: 2.5 / 4.5 is under the 60% threshold.
select is(public.close_game_day_unchecked('2032-05-01'), 'broken', 'the day closes broken');
select is((select final_pass_rate from public.game_days where game_date = '2032-05-01'), 2.5 / 4.5, 'its rate is weighted passed days over completed days');
select is(public.close_game_day_unchecked('2032-05-01'), 'broken', 'closing again is idempotent');
select is((select final_pass_rate from public.game_days where game_date = '2032-05-01'), 2.5 / 4.5, 'and keeps the rate');

-- A day with a started game but no completed day closes broken with no rate.
select tests.make_player(tests.p(7));
select tests.start('00000000-0000-0000-0000-000000007001', tests.p(7), '2032-05-02', 1);
select is(public.close_game_day_unchecked('2032-05-02'), 'broken', 'a day nobody completed closes broken');
select is((select final_pass_rate from public.game_days where game_date = '2032-05-02'), null, 'with no rate');

-- Players read only their own day results and cannot write any.
select ok((select relrowsecurity from pg_class where oid = 'public.day_results'::regclass), 'RLS is enabled on day_results');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.day_results), 1, 'a player reads only their own day result');
select throws_ok(
  $$update public.day_results set outcome = 'passed'$$, '42501', null, 'and cannot change it'
);
reset role;

select * from finish();
rollback;
