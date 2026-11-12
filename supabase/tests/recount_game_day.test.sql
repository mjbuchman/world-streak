begin;
select plan(5);

\ir fixtures/fixtures.psql

select function_privs_are('public', 'recount_game_day', array['date'], 'service_role', array['EXECUTE'], 'the server can recount a day');
select function_privs_are('public', 'recount_game_day', array['date'], 'authenticated', array[]::text[], 'players cannot');
select function_privs_are('public', 'recount_game_day', array['date'], 'anon', array[]::text[], 'visitors cannot');

-- Three attempts today: a full-weight pass, a half-weight fail, an unfinished one; then counters
-- left wrong, as a deleted attempt leaves them.
select tests.clear_today();
select tests.make_player('00000000-0000-0000-0000-0000000000b1');
select tests.make_player('00000000-0000-0000-0000-0000000000b2', 0.5);
select tests.make_player('00000000-0000-0000-0000-0000000000b3');
select tests.start('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000b1', public.game_date_at(now()), 1);
select tests.start('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000b2', public.game_date_at(now()), 2);
select tests.start('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000b3', public.game_date_at(now()), 3);
update public.attempts set passed = true, submitted_at = now() where id = '00000000-0000-0000-0000-00000000e001';
update public.attempts set passed = false, submitted_at = now() where id = '00000000-0000-0000-0000-00000000e002';
update public.game_day_counters set attempts = 9, passes = 7, weighted_attempts = 9, weighted_passes = 7
 where game_date = public.game_date_at(now());

select public.recount_game_day(public.game_date_at(now()));
select results_eq(
  format('select attempts, passes, weighted_attempts, weighted_passes from public.game_day_counters where game_date = %L', public.game_date_at(now())),
  $$values (3, 1, 2.5::numeric, 1::numeric)$$,
  'the counters match the attempts again, at their weights'
);

-- A day with no attempts left goes back to zero.
delete from public.attempts where game_date = public.game_date_at(now());
select public.recount_game_day(public.game_date_at(now()));
select results_eq(
  format('select attempts, passes, weighted_attempts, weighted_passes from public.game_day_counters where game_date = %L', public.game_date_at(now())),
  $$values (0, 0, 0::numeric, 0::numeric)$$,
  'a day with no attempts recounts to zero'
);

select * from finish();
rollback;
