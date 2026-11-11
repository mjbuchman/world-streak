begin;
select plan(10);

-- The schedule.
select results_eq(
  $$select schedule, command from cron.job where jobname = 'close-due-game-days'$$,
  $$values ('0 0 * * *'::text, 'select public.close_due_game_days()'::text)$$,
  'the close job runs at the midnight UTC deadline'
);
select results_eq(
  $$select schedule, command from cron.job where jobname = 'close-due-game-days-safety-net'$$,
  $$values ('*/5 * * * *'::text, 'select public.close_due_game_days()'::text)$$,
  'and every 5 minutes as a safety net'
);
select function_privs_are('public', 'close_due_game_days', array['timestamptz'], 'service_role', array['EXECUTE'], 'the server can run the close job');
select function_privs_are('public', 'close_due_game_days', array['timestamptz'], 'anon', array[]::text[], 'visitors cannot');
select function_privs_are('public', 'close_due_game_days', array['timestamptz'], 'authenticated', array[]::text[], 'players cannot');

-- Fixtures: three open days, 2026-11-01 to 2026-11-03, and every earlier day closed (the local
-- database may hold open days from dev runs). All inside this rolled-back transaction.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2026-11-01';
select tests.play_day('2026-11-01', 10, 8, 0.60);
select tests.play_day('2026-11-02', 10, 9, 0.60);
select tests.play_day('2026-11-03', 10, 2, 0.60);
-- The local schedule may already have closed 2026-11-04 for real; here it is the day being played.
update public.game_days set closed_at = null, outcome = null, final_pass_rate = null where game_date = '2026-11-04';

-- 30 seconds after the deadline of 2026-11-03.
select is(public.close_due_game_days('2026-11-04T00:00:30Z'), 3, 'one call closes the three due days');
select results_eq(
  $$select game_date, outcome from public.game_days where game_date between '2026-11-01' and '2026-11-03' order by game_date$$,
  $$values ('2026-11-01'::date, 'survived'::text), ('2026-11-02'::date, 'survived'::text), ('2026-11-03'::date, 'broken'::text)$$,
  'in date order: two survived days, then a broken one'
);
select results_eq(
  $$select start_date, end_date, length from public.streak_runs$$,
  $$values ('2026-11-01'::date, '2026-11-02'::date, 2)$$,
  'so the streak ran for 2 days, ended by the third (it could only be built in order)'
);
select is(
  (select closed_at from public.game_days where game_date = '2026-11-04'), null,
  'the day being played exists and stays open'
);

-- A second call has nothing to do.
select is(public.close_due_game_days('2026-11-04T00:00:30Z'), 0, 'a second call closes nothing');

select * from finish();
rollback;
