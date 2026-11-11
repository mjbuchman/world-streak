begin;
select plan(16);

-- Every attempt carries the weight it was counted with.
select col_not_null('public', 'attempts', 'counted_weight', 'counted_weight is required');
select is(
  (select prosecdef from pg_proc where oid = 'public.stamp_attempt_weight()'::regprocedure), false,
  'stamping the weight runs as the inserting role (security invoker): only the server inserts attempts'
);

-- Fixtures. Results are only accepted for today's game date, so the attempts are on it.
\ir fixtures/fixtures.psql
create temporary table today as select tests.clear_today() as d;
-- A closed day with no counters row, so a refused start there would show up as a new row.
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, closed_at, outcome)
values ('2000-01-01', 'stacking', 10, 0.6, '2000-01-02T00:00:05Z', 'survived');
select tests.make_player('00000000-0000-0000-0000-00000000000a');
select tests.make_player('00000000-0000-0000-0000-00000000000b');
select tests.make_player('00000000-0000-0000-0000-00000000000c', 0.5);

select tests.start('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', d, 1) from today;
-- An insert cannot show this (the before-insert trigger always sets the weight), so an update does.
select throws_ok(
  $$update public.attempts set counted_weight = null where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23502', null, 'an attempt cannot lose its counted weight'
);

-- A start on a closed day is refused, with a code the server can recognise, and counts nothing.
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000b', '2000-01-01', 2)$$,
  'WS001', 'game day 2000-01-01 is closed', 'a start on a closed day is refused'
);
select is_empty(
  $$select 1 from public.attempts where game_date = '2000-01-01'$$,
  'the refused start stored no attempt'
);
select is_empty(
  $$select 1 from public.game_day_counters where game_date = '2000-01-01'$$,
  'the refused start counted nothing'
);
-- Closing today stops later starts too; reopening (as the test superuser) lets them through.
update public.game_days set closed_at = now() where game_date = (select d from today);
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000b', (select d from today), 3)$$,
  'WS001', null, 'once today is closed, a start for today is refused'
);
update public.game_days set closed_at = null where game_date = (select d from today);
select lives_ok(
  $$insert into public.attempts (id, user_id, game_date, seed)
    values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', (select d from today), 4)$$,
  'a start on an open day goes through'
);
select results_eq(
  $$select attempts from public.game_day_counters where game_date = (select d from today)$$,
  $$values (2)$$,
  'both open-day starts are counted'
);

-- The server inserts as service_role. With stamp_attempt_weight now security invoker, that role
-- must still read the profile's weight, so the insert stamps 0.5 and counts it. This relies on
-- Supabase's default table grants to service_role (no migration grants them), so it would fail
-- if those defaults ever changed.
set local role service_role;
select is(current_user::text, 'service_role', 'setup: the insert below really runs as service_role');
select lives_ok(
  $$insert into public.attempts (id, user_id, game_date, seed)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', public.game_date_at(now()), 5)$$,
  'the server (service_role) can start an attempt'
);
reset role;
select is(
  (select counted_weight from public.attempts where id = '00000000-0000-0000-0000-0000000000c1'), 0.5::numeric,
  'the service_role insert stamps the profile''s weight'
);
select results_eq(
  $$select attempts, weighted_attempts from public.game_day_counters where game_date = (select d from today)$$,
  $$values (3, 2.5::numeric)$$,
  'and the start is counted with that weight'
);

-- A pass whose day has no counters row raises instead of recording a pass nobody counted.
delete from public.game_day_counters where game_date = (select d from today);
select throws_ok(
  $$select public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{"tapsMs":[900]}', 12, true)$$,
  'P0001', null, 'a pass with no counters row for its day raises'
);
select results_eq(
  $$select submitted_at is null from public.attempts where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values (true)$$,
  'and its result was not stored either'
);
-- A fail adds nothing to the counters, so it records even without a row.
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000b1', '{"tapsMs":[900]}', 3, false),
  'recorded',
  'a fail still records without a counters row (it adds nothing to them)'
);

select * from finish();
rollback;
