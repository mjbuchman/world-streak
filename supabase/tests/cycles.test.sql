begin;
select plan(19);

-- The table: a flat prize with rollover, and no revenue share, floor or cap (human's instruction).
select has_table('public', 'cycles', 'cycles exists');
select columns_are('public', 'cycles', array[
  'number', 'start_date', 'end_date', 'base_prize_cents', 'rollover_in_cents',
  'goal_reached_on', 'winner_user_id', 'drawn_at', 'paid_on'
], 'only the flat-prize columns');
select col_is_pk('public', 'cycles', 'number', 'number is the key');
select col_default_is('public', 'cycles', 'base_prize_cents', '20000', 'the prize is $200 a cycle');
select col_default_is('public', 'cycles', 'rollover_in_cents', '0', 'nothing rolls in by default');

-- Cycle 1: 60 days from 2027-01-01, inclusive.
select results_eq(
  $$select number, start_date, end_date, base_prize_cents, rollover_in_cents from public.cycles$$,
  $$values (1, '2027-01-01'::date, '2027-03-01'::date, 20000, 0)$$,
  'cycle 1 runs from 2027-01-01 to 2027-03-01'
);
select is(('2027-03-01'::date - '2027-01-01'::date) + 1, 60, 'which is 60 days');

-- cycle_for: the cycle containing a date, or null.
select is(public.cycle_for('2026-12-31'), null, 'the day before is preseason');
select is(public.cycle_for('2027-01-01'), 1, 'the first day is cycle 1');
select is(public.cycle_for('2027-02-01'), 1, 'a day in the middle is cycle 1');
select is(public.cycle_for('2027-03-01'), 1, 'the last day is cycle 1');
select is(public.cycle_for('2027-03-02'), null, 'the day after is in no cycle until cycle 2 exists');
insert into public.cycles (number, start_date, end_date) values (2, '2027-03-02', '2027-04-30');
select is(public.cycle_for('2027-03-02'), 2, 'and then it is cycle 2');

-- Everyone may read cycles, but not who won.
select columns_are('public', 'cycles_public', array[
  'number', 'start_date', 'end_date', 'base_prize_cents', 'rollover_in_cents', 'goal_reached_on', 'drawn_at', 'paid_on'
], 'the public view has every column but the winner');
\ir fixtures/fixtures.psql
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
update public.cycles set winner_user_id = '00000000-0000-0000-0000-0000000000b0' where number = 1;
set local role anon;
select is((select count(*)::int from public.cycles_public), 2, 'a visitor reads every cycle through the public view');
select throws_ok($$select winner_user_id from public.cycles$$, '42501', null, 'but not the winner');
select throws_ok(
  $$update public.cycles set rollover_in_cents = 1 where number = 1$$,
  '42501', null, 'and cannot write'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select winner_user_id from public.cycles$$, '42501', null, 'a signed-in player cannot read the winner either');
select throws_ok(
  $$insert into public.cycles (number, start_date, end_date) values (3, '2027-05-01', '2027-06-29')$$,
  '42501', null, 'nor add a cycle'
);
reset role;

select * from finish();
rollback;
