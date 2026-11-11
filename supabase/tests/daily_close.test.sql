begin;
select plan(38);

-- Structure, row-level security and privileges.
select has_table('public', 'streak_runs', 'streak_runs table exists');
select columns_are('public', 'streak_runs', array['id', 'start_date', 'end_date', 'length'], 'streak_runs has its four columns');
select ok((select relrowsecurity from pg_class where oid = 'public.streak_runs'::regclass), 'RLS is enabled on streak_runs');
select policies_are('public', 'streak_runs', array['streak_runs_select_all'], 'streak_runs has only the public read policy');
select table_privs_are('public', 'streak_runs', 'anon', array['SELECT'], 'anonymous visitors can only read the streak');
select table_privs_are('public', 'streak_runs', 'authenticated', array['SELECT'], 'signed-in players can only read the streak');
select function_privs_are('public', 'close_game_day', array['date'], 'service_role', array['EXECUTE'], 'the server can close a day');
select function_privs_are('public', 'close_game_day', array['date'], 'authenticated', array[]::text[], 'players cannot close a day');
select function_privs_are('public', 'close_game_day', array['date'], 'anon', array[]::text[], 'visitors cannot close a day');
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.close_game_day(date)'::regprocedure),
  'close_game_day runs as its owner with an empty search_path'
);
select function_privs_are('public', 'world_streak', array[]::text[], 'anon', array['EXECUTE'], 'anyone can read the world streak');

-- Fixtures: days far in the past. The streak starts empty inside this rolled-back transaction.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
create temporary view day as
  select game_date, final_pass_rate, outcome, closed_at is not null as closed from public.game_days;
create temporary view streak as select * from public.world_streak();

-- The threshold itself counts as surviving: 6 of 10 at 0.60.
select tests.play_day('2000-01-01', 10, 6, 0.60);
select is(public.close_game_day('2000-01-01'), 'survived', '6 of 10 at a 0.60 threshold survives');
select results_eq(
  $$select final_pass_rate, outcome, closed from day where game_date = '2000-01-01'$$,
  $$values (0.6::numeric, 'survived'::text, true)$$,
  'the day stores its final pass rate, outcome and close time'
);
select results_eq('select * from streak', $$values (1, 1, '2000-01-01'::date)$$, 'a first survived day starts a streak of 1');

-- The rate is weighted: 5 plain passes of 10, but 5 of 8 weighted attempts (0.625).
select tests.play_day('2000-01-02', 10, 5, 0.60);
update public.game_day_counters set weighted_attempts = 8, weighted_passes = 5 where game_date = '2000-01-02';
select is(public.close_game_day('2000-01-02'), 'survived', 'the weighted pass rate decides, not the plain one');
select is((select final_pass_rate from day where game_date = '2000-01-02'), 0.625::numeric, 'the final rate is weighted passes over weighted attempts');

select tests.play_day('2000-01-03', 10, 9, 0.60);
select public.close_game_day('2000-01-03');
select results_eq('select * from streak', $$values (3, 3, '2000-01-01'::date)$$, 'three survived days in a row make a streak of 3');

-- Below the threshold: 5 of 10.
select tests.play_day('2000-01-04', 10, 5, 0.60);
select is(public.close_game_day('2000-01-04'), 'broken', '5 of 10 at a 0.60 threshold breaks');
select results_eq('select * from streak', $$values (0, 3, null::date)$$, 'a broken day resets the streak to 0 and keeps the best of 3');
select results_eq(
  $$select start_date, end_date, length from public.streak_runs$$,
  $$values ('2000-01-01'::date, '2000-01-03'::date, 3)$$,
  'the run ends on its last survived day'
);

-- Nobody played: no game day row at all, or a row with no counters. Both break, with no rate.
select is(public.close_game_day('2000-01-05'), 'broken', 'a day nobody started closes as broken');
select results_eq(
  $$select final_pass_rate, outcome, closed from day where game_date = '2000-01-05'$$,
  $$values (null::numeric, 'broken'::text, true)$$,
  'and has no final pass rate'
);
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold) values ('2000-01-06', 'stacking', 10, 0.6);
select is(public.close_game_day('2000-01-06'), 'broken', 'a day with no counters row closes as broken');
-- Only zero-weight accounts played: attempts but no weighted attempts.
select tests.play_day('2000-01-07', 3, 3, 0.60);
update public.game_day_counters set weighted_attempts = 0, weighted_passes = 0 where game_date = '2000-01-07';
select is(public.close_game_day('2000-01-07'), 'broken', 'a day with no weighted attempts closes as broken');
select is((select final_pass_rate from day where game_date = '2000-01-07'), null::numeric, 'with no final pass rate');

-- A new run after a break.
select tests.play_day('2000-01-08', 10, 8, 0.60);
select public.close_game_day('2000-01-08');
select results_eq('select * from streak', $$values (1, 3, '2000-01-08'::date)$$, 'a survived day after a break starts a new run of 1');

-- Idempotent: closing a closed day again changes nothing and returns its outcome.
create temporary table before as
  select (select array_agg(row(d.*)::text order by game_date) from public.game_days d where game_date < '2000-02-01') as days,
         (select array_agg(row(r.*)::text order by id) from public.streak_runs r) as runs;
-- Even if its counts changed after the close, the stored result stands.
update public.game_day_counters set passes = 0, weighted_passes = 0 where game_date = '2000-01-08';
select is(public.close_game_day('2000-01-08'), 'survived', 'closing a closed day again returns its outcome');
select is(public.close_game_day('2000-01-04'), 'broken', 'also for a broken day');
select results_eq(
  $$select (select array_agg(row(d.*)::text order by game_date) from public.game_days d where game_date < '2000-02-01'),
           (select array_agg(row(r.*)::text order by id) from public.streak_runs r)$$,
  'select days, runs from before',
  're-running the close leaves every day and run as it was'
);
select results_eq('select * from streak', $$values (1, 3, '2000-01-08'::date)$$, 'and does not count the streak twice');

-- Days close in order, and only after their deadline.
select tests.play_day('2000-01-09', 10, 8, 0.60);
select tests.play_day('2000-01-10', 10, 8, 0.60);
select throws_ok(
  $$select public.close_game_day('2000-01-10')$$,
  'P0001', 'an earlier game day is still open; close days in order', 'a day cannot close while an earlier one is open'
);
select is((select closed from day where game_date = '2000-01-10'), false, 'the refused day stays open');
select throws_ok(
  $$select public.close_game_day(public.game_date_at(now()))$$,
  'P0001', null, 'today cannot close before its deadline'
);

-- A day is closed with its outcome, never one without the other.
select throws_ok(
  $$update public.game_days set closed_at = now() where game_date = '2000-01-09'$$,
  '23514', null, 'a day cannot be closed without an outcome'
);
select throws_ok(
  $$update public.game_days set outcome = 'broken' where game_date = '2000-01-09'$$,
  '23514', null, 'nor given an outcome while open'
);
select throws_ok(
  $$insert into public.streak_runs (start_date, length) values ('2000-01-09', 1)$$,
  '23505', null, 'there is only ever one open run'
);

-- Visitors read the streak and nothing else.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq('select * from public.world_streak()', $$values (1, 3, '2000-01-08'::date)$$, 'an anonymous visitor reads the world streak');
select throws_ok($$delete from public.streak_runs$$, '42501', null, 'an anonymous visitor cannot change the streak');
reset role;

select * from finish();
rollback;
