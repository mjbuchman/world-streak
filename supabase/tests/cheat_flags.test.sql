begin;
select plan(15);

select has_table('public', 'cheat_flags', 'cheat_flags exists');
select columns_are('public', 'cheat_flags', array['id', 'user_id', 'attempt_id', 'reason', 'created_at', 'status'], 'its columns');
select col_default_is('public', 'cheat_flags', 'status', 'open', 'a new flag is open');

-- Fixtures: two players with attempts on three days of a cycle (moved into 2000 for the test).
\ir fixtures/fixtures.psql
update public.cycles set start_date = '2000-01-01', end_date = '2000-02-29' where number = 1;
select tests.make_player('00000000-0000-0000-0000-0000000000f1');
select tests.make_player('00000000-0000-0000-0000-0000000000f2');
select tests.play_day(d, 0, 0) from (values ('2000-01-05'::date), ('2000-01-06'), ('2000-01-07')) as days(d);
insert into public.attempts (id, user_id, game_date, seed, submitted_at, score, passed)
select ('00000000-0000-0000-0000-00000000f' || p || '0' || n)::uuid, ('00000000-0000-0000-0000-0000000000f' || p)::uuid,
       ('2000-01-0' || (4 + n))::date, n, now(), 12, true
  from (values (1), (2)) as players(p), (values (1), (2), (3)) as days(n);
insert into public.entries (attempt_id, user_id, cycle_number, game_date)
select id, user_id, 1, game_date from public.attempts where user_id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
update public.game_day_counters set passes = 2, weighted_passes = 2 where game_date between '2000-01-05' and '2000-01-07';

select is(
  (select count(*)::int from public.drawable_entries where cycle_number = 1), 6,
  'setup: both players'' three entries are drawable'
);

-- Recording flags: one row per reason, and the account is flagged.
select public.record_cheat_flags('00000000-0000-0000-0000-00000000f101', array['stacking-min-interval', 'timing-mismatch']);
select results_eq(
  $$select user_id, attempt_id, reason, status from public.cheat_flags order by reason$$,
  $$values ('00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-00000000f101'::uuid, 'stacking-min-interval', 'open'),
           ('00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-00000000f101'::uuid, 'timing-mismatch', 'open')$$,
  'one open flag per reason, for that attempt and its player'
);
select is((select flagged from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), true, 'the account is flagged');
select public.record_cheat_flags('00000000-0000-0000-0000-00000000f101', array['timing-mismatch']);
select is((select count(*)::int from public.cheat_flags), 2, 'recording the same reason again adds nothing');
select public.record_cheat_flags('00000000-0000-0000-0000-00000000f201', array[]::text[]);
select is((select flagged from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'), false, 'no reasons flag nothing');

-- A flag never changes a result: the pass and the day's counters stay as they were.
select results_eq(
  $$select passed, score from public.attempts where id = '00000000-0000-0000-0000-00000000f101'$$,
  $$values (true, 12::numeric)$$,
  'the flagged attempt still passed'
);
select is((select passes from public.game_day_counters where game_date = '2000-01-05'), 2, 'and still counts in the day''s passes');

-- The draw leaves the flagged account out.
select is(
  (select count(*)::int from public.drawable_entries where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'a flagged player with three entries contributes none to the draw'
);
select is(
  (select count(*)::int from public.drawable_entries where user_id = '00000000-0000-0000-0000-0000000000f2'), 3,
  'an unflagged player keeps theirs'
);

-- Clients see none of it.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.cheat_flags$$, '42501', null, 'a player cannot read flags, even their own');
select throws_ok($$select * from public.drawable_entries$$, '42501', null, 'nor the drawable entries');
select throws_ok(
  $$select public.record_cheat_flags('00000000-0000-0000-0000-00000000f201', array['x'])$$,
  '42501', null, 'nor record a flag'
);
reset role;

select * from finish();
rollback;
