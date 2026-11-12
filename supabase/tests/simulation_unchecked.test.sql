begin;
select plan(21);

-- The simulation's functions (T37): they play and close days that are not today, so cycle 1
-- (2027-01-01 onwards) can be tested on its real dates.
\ir fixtures/fixtures.psql
update public.game_settings set rotation = '{stacking}', percentile_min_sample = 2147483647;
-- A local database may hold an earlier simulation; the rollback brings it back.
delete from public.attempts where game_date >= '2027-01-01';
delete from public.game_day_counters where game_date >= '2027-01-01';
delete from public.game_days where game_date >= '2027-01-01';
delete from public.streak_runs;
update public.cycles set goal_reached_on = null where number = 1;

select function_privs_are('public', 'close_game_day_unchecked', array['date'], 'service_role', array['EXECUTE'], 'the server can run the unchecked close');
select function_privs_are('public', 'close_game_day_unchecked', array['date'], 'authenticated', array[]::text[], 'players cannot');
select function_privs_are('public', 'close_game_day_unchecked', array['date'], 'anon', array[]::text[], 'visitors cannot');
select function_privs_are('public', 'record_attempt_result_unchecked', array['uuid', 'jsonb', 'numeric', 'boolean'], 'service_role', array['EXECUTE'], 'the server can record any open day');
select function_privs_are('public', 'record_attempt_result_unchecked', array['uuid', 'jsonb', 'numeric', 'boolean'], 'authenticated', array[]::text[], 'players cannot');
select function_privs_are('public', 'record_attempt_result_unchecked', array['uuid', 'jsonb', 'numeric', 'boolean'], 'anon', array[]::text[], 'visitors cannot');

-- The checked versions keep their checks.
select throws_ok(
  format('select public.close_game_day(%L)', public.game_date_at(now())),
  null, format('game day %s has not reached its deadline', public.game_date_at(now())),
  'the scheduled close still refuses today'
);
select tests.make_player('00000000-0000-0000-0000-0000000000a1');
select tests.make_player('00000000-0000-0000-0000-0000000000a2');
select public.ensure_game_day('2027-01-01');
select tests.start('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', '2027-01-01', 1);
select is(
  public.record_attempt_result('00000000-0000-0000-0000-00000000f001', '{}', 11, true), 'day-closed',
  'the app''s submit still refuses a day that is not today'
);
select is((select submitted_at from public.attempts where id = '00000000-0000-0000-0000-00000000f001'), null, 'and records nothing');

-- Days must still close in order: today and the days up to 2026-12-31 are open.
select throws_ok(
  $$select public.close_game_day_unchecked('2027-01-01')$$,
  null, 'an earlier game day is still open; close days in order',
  'the unchecked close still closes days in order'
);
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2027-01-01';

-- The unchecked result: a pass on a future day counts and earns its cycle entry.
select is(
  public.record_attempt_result_unchecked('00000000-0000-0000-0000-00000000f001', '{}', 11, true), 'recorded',
  'the unchecked submit records a future day'
);
select results_eq(
  $$select passes, weighted_passes from public.game_day_counters where game_date = '2027-01-01'$$,
  $$values (1, 1::numeric)$$,
  'and counts the pass'
);
select results_eq(
  $$select cycle_number, game_date from public.entries where attempt_id = '00000000-0000-0000-0000-00000000f001'$$,
  $$values (1, '2027-01-01'::date)$$,
  'and adds the entry for cycle 1'
);
select is(
  public.record_attempt_result_unchecked('00000000-0000-0000-0000-00000000f001', '{}', 11, true), 'already-submitted',
  'one result per attempt still holds'
);
select is(
  public.record_attempt_result_unchecked('00000000-0000-0000-0000-00000000ffff', '{}', 11, true), 'not-found',
  'an unknown attempt is not found'
);

-- The unchecked close closes days early, with their real outcomes: 30 survived days from the
-- cycle start reach the goal, as `npm run simulate:days -- --from 2027-01-01 --days 30` does.
select is(public.close_game_day_unchecked('2027-01-01'), 'survived', 'the unchecked close closes a future day');
do $$
begin
  for i in 1 .. 29 loop
    perform tests.play_day('2027-01-01'::date + i, 10, 8);
    perform public.close_game_day_unchecked('2027-01-01'::date + i);
  end loop;
end;
$$;
select is((select current from public.world_streak()), 30, 'after 30 survived days the world streak is 30');
select is((select goal_reached_on from public.cycles where number = 1), '2027-01-30'::date, 'and cycle 1 reached its goal on 2027-01-30');
select is((select count(*)::int from public.game_days where game_date = '2027-01-31' and closed_at is null), 1, 'the next day is prepared and open');

-- No result on a day once it is closed.
select tests.start('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000a2', '2027-01-31', 1);
select is(public.close_game_day_unchecked('2027-01-31'), 'broken', 'a day with no passes closes broken');
select is(
  public.record_attempt_result_unchecked('00000000-0000-0000-0000-00000000f002', '{}', 11, true), 'day-closed',
  'no result on a closed day'
);

select * from finish();
rollback;
