begin;
select plan(31);

-- Structure, row-level security and policies.
select has_table('public', 'game_day_counters', 'game_day_counters table exists');
select col_is_pk('public', 'game_day_counters', 'game_date', 'game_date is the primary key');
select fk_ok('public', 'game_day_counters', 'game_date', 'public', 'game_days', 'game_date', 'game_date references game_days');
select col_type_is('public', 'game_day_counters', 'attempts', 'integer', 'attempts is an integer');
select col_type_is('public', 'game_day_counters', 'weighted_passes', 'numeric', 'weighted_passes is numeric');
select col_type_is('public', 'attempts', 'counted_weight', 'numeric', 'each attempt keeps the weight it was counted with');
select ok((select relrowsecurity from pg_class where oid = 'public.game_day_counters'::regclass), 'RLS is enabled on game_day_counters');
-- Server only (T18): the meter hides the live numbers in the final hours, which only works if
-- nobody can read the counters directly with the public anon key.
select policies_are('public', 'game_day_counters', array[]::name[], 'counters have no policies: only the server reads them');
select table_privs_are('public', 'game_day_counters', 'anon', array[]::text[], 'anonymous visitors have no privileges on the counters');
select table_privs_are('public', 'game_day_counters', 'authenticated', array[]::text[], 'signed-in players have no privileges on the counters');

-- Fixtures. Results are only accepted for today's game date, so the attempts are on it.
\ir fixtures/fixtures.psql
create temporary table today as select tests.clear_today() as d;
select tests.make_player('00000000-0000-0000-0000-00000000000a');
select tests.make_player('00000000-0000-0000-0000-00000000000b');
select tests.make_player('00000000-0000-0000-0000-00000000000c');
select tests.make_player('00000000-0000-0000-0000-00000000000d', 0.5);
select tests.make_player('00000000-0000-0000-0000-00000000000e');
select tests.make_player('00000000-0000-0000-0000-00000000000f');

create temporary view counters as
  select attempts, passes, weighted_attempts, weighted_passes
  from public.game_day_counters where game_date = (select d from today);

-- An attempt counts when it starts (the start endpoint's insert), before any result.
select tests.start('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', d, 1) from today;
select tests.start('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', d, 2) from today;
select tests.start('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000c', d, 3) from today;
select results_eq(
  'select * from counters',
  $$values (3, 0, 3::numeric, 0::numeric)$$,
  'three started attempts count as three attempts and no passes'
);

-- Two passes and a fail.
select public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{"tapsMs":[900]}', 12, true);
select public.record_attempt_result('00000000-0000-0000-0000-0000000000b1', '{"tapsMs":[900]}', 11, true);
select public.record_attempt_result('00000000-0000-0000-0000-0000000000c1', '{"tapsMs":[900]}', 3, false);
select results_eq(
  'select * from counters',
  $$values (3, 2, 3::numeric, 2::numeric)$$,
  'after 3 attempts with 2 passes at weight 1: attempts 3, passes 2, weighted 3 and 2'
);

-- A player with weight 0.5 who passes adds 0.5 to both weighted columns.
select tests.start('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000d', d, 4) from today;
select public.record_attempt_result('00000000-0000-0000-0000-0000000000d1', '{"tapsMs":[900]}', 12, true);
select results_eq(
  'select * from counters',
  $$values (4, 3, 3.5::numeric, 2.5::numeric)$$,
  'a weight-0.5 pass adds 1 to the plain counts and 0.5 to both weighted counts'
);
select is(
  (select counted_weight from public.attempts where id = '00000000-0000-0000-0000-0000000000d1'), 0.5::numeric,
  'the attempt keeps the weight it was counted with'
);

-- Abandoned: started, never submitted. It stays counted as an attempt that did not pass.
select tests.start('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000e', d, 5) from today;
select results_eq(
  'select * from counters',
  $$values (5, 3, 4.5::numeric, 2.5::numeric)$$,
  'an abandoned attempt counts as an attempt that did not pass'
);

-- A second submission records nothing and counts nothing.
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{"tapsMs":[900]}', 12, true),
  'already-submitted',
  'setup: a second submission is refused'
);
select results_eq('select * from counters', $$values (5, 3, 4.5::numeric, 2.5::numeric)$$, 'a refused second submission adds no pass');

-- A weight change after the start does not change what the pass adds: attempts and passes
-- always use the same weight, so the weighted pass rate stays between 0 and 1.
select tests.start('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000f', d, 6) from today;
update public.profiles set weight = 0 where id = '00000000-0000-0000-0000-00000000000f';
select public.record_attempt_result('00000000-0000-0000-0000-0000000000f1', '{"tapsMs":[900]}', 12, true);
select results_eq(
  'select * from counters',
  $$values (6, 4, 5.5::numeric, 3.5::numeric)$$,
  'a pass adds the weight the attempt started with, even if the profile weight changed since'
);

-- A pass refused because the day closed is not counted as a pass.
update public.attempts set submitted_at = null, score = null, passed = null
  where id = '00000000-0000-0000-0000-0000000000c1';
update public.game_days set closed_at = now(), outcome = 'broken' where game_date = (select d from today);
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000c1', '{"tapsMs":[900]}', 12, true),
  'day-closed',
  'setup: a submission after the day closed is refused'
);
select results_eq('select * from counters', $$values (6, 4, 5.5::numeric, 3.5::numeric)$$, 'a refused late pass adds nothing');
update public.game_days set closed_at = null, outcome = null where game_date = (select d from today);

-- A refused second start (the unique constraint the start endpoint relies on) counts nothing.
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', (select d from today), 8)$$,
  '23505', null, 'setup: a second start for the same player and day is a unique violation'
);
select results_eq('select * from counters', $$values (6, 4, 5.5::numeric, 3.5::numeric)$$, 'a refused second start adds no attempt');

-- The counts can never claim more passes than attempts.
select throws_ok(
  $$update public.game_day_counters set passes = attempts + 1 where game_date = (select d from today)$$,
  '23514', null, 'passes cannot exceed attempts'
);
select throws_ok(
  $$update public.game_day_counters set weighted_passes = weighted_attempts + 1 where game_date = (select d from today)$$,
  '23514', null, 'weighted passes cannot exceed weighted attempts'
);

-- Players and visitors can read the counters but never write them. These query the table
-- directly: the temporary view would run with its owner's rights and skip row-level security.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select attempts from public.game_day_counters$$,
  '42501', null, 'a signed-in player cannot read the counters directly'
);
select throws_ok(
  $$insert into public.game_day_counters (game_date) values ('2000-01-01')$$,
  '42501', null, 'a signed-in player cannot insert counters'
);
-- A refused attempt insert must not reach the counting trigger (it runs after insert only).
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', public.game_date_at(now()), 7)$$,
  '42501', null, 'a signed-in player cannot insert an attempt, and the refusal comes from RLS first'
);
select throws_ok(
  $$update public.game_day_counters set passes = 0, weighted_passes = 0$$,
  '42501', null, 'a signed-in player cannot reset the passes'
);
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$select attempts from public.game_day_counters$$,
  '42501', null, 'an anonymous visitor cannot read the counters directly'
);
select throws_ok(
  $$insert into public.game_day_counters (game_date) values ('2000-01-01')$$,
  '42501', null, 'an anonymous visitor cannot insert counters'
);
reset role;
select results_eq(
  'select * from counters',
  $$values (6, 4, 5.5::numeric, 3.5::numeric)$$,
  'the refused writes changed nothing'
);

select * from finish();
rollback;
