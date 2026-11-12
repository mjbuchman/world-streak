begin;
select plan(16);

select has_table('public', 'entries', 'entries exists');
select col_is_unique('public', 'entries', array['user_id', 'game_date'], 'one entry per player per game day');

-- Results are accepted only for today, so cycle 1 moves to cover today for the in-cycle cases.
\ir fixtures/fixtures.psql
create temporary table today as select tests.clear_today() as d;
update public.cycles set start_date = d - 1, end_date = d + 58 from today where number = 1;
select tests.make_player('00000000-0000-0000-0000-0000000000e1');
select tests.make_player('00000000-0000-0000-0000-0000000000e2');
select tests.make_player('00000000-0000-0000-0000-0000000000e3');
select tests.start('00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-0000000000e1', d, 1) from today;
select tests.start('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-0000000000e2', d, 2) from today;
select tests.start('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-0000000000e3', d, 3) from today;

select is(public.record_attempt_result('00000000-0000-0000-0000-00000000e101', '{}', 12, true), 'recorded', 'setup: a pass');
select results_eq(
  $$select user_id, cycle_number, game_date from public.entries$$,
  $$select '00000000-0000-0000-0000-0000000000e1'::uuid, 1, d from today$$,
  'a passed attempt in a cycle earns one entry for that cycle and day'
);
select is(public.record_attempt_result('00000000-0000-0000-0000-00000000e201', '{}', 3, false), 'recorded', 'setup: a fail');
select is(
  (select count(*)::int from public.entries where user_id = '00000000-0000-0000-0000-0000000000e2'), 0,
  'a failed attempt earns none'
);
select is(
  public.record_attempt_result('00000000-0000-0000-0000-00000000e101', '{}', 12, true), 'already-submitted',
  'a second submit records nothing'
);
select is((select count(*)::int from public.entries), 1, 'so still one entry');

-- Preseason: no cycle contains today.
update public.cycles set start_date = '2027-01-01', end_date = '2027-03-01' where number = 1;
select is(public.record_attempt_result('00000000-0000-0000-0000-00000000e301', '{}', 12, true), 'recorded', 'setup: a preseason pass');
select is(
  (select count(*)::int from public.entries where user_id = '00000000-0000-0000-0000-0000000000e3'), 0,
  'a preseason pass earns no entry'
);

-- Players see only their own entries, and cannot write any.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.entries), 0, 'a player cannot read another player''s entries');
select is(public.my_entry_count(1), 0, 'and counts none of their own');
select throws_ok(
  $$insert into public.entries (attempt_id, user_id, cycle_number, game_date) values ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-0000000000e2', 1, '2027-01-01')$$,
  '42501', null, 'a player cannot add an entry'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select is(public.my_entry_count(1), 1, 'the player who passed counts their entry');
select is(public.my_entry_count(2), 0, 'in that cycle only');
reset role;

-- Clearing an attempt (as the local tools do) takes its entry with it.
delete from public.attempts where id = '00000000-0000-0000-0000-00000000e101';
select is((select count(*)::int from public.entries), 0, 'an entry goes with its attempt');

select * from finish();
rollback;
