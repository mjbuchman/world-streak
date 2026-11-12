begin;
select plan(13);

-- Fixtures: cycle 1 moved into 2000 and won; players A (3 entries), B (1) and C (2, flagged);
-- cycle 2 still running and cycle 3 ended without the goal.
\ir fixtures/fixtures.psql
update public.cycles set start_date = '2000-01-01', end_date = '2000-02-29', goal_reached_on = '2000-01-30' where number = 1;
insert into public.cycles (number, start_date, end_date) values (2, '2000-03-01', '2100-01-01');
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player(('00000000-0000-0000-0000-0000000000' || p)::uuid) from (values ('a1'), ('b1'), ('c1')) as players(p);
update public.profiles set flagged = true where id = '00000000-0000-0000-0000-0000000000c1';
select tests.play_day(('2000-01-0' || n)::date, 0, 0) from generate_series(1, 3) as n;
insert into public.attempts (id, user_id, game_date, seed, submitted_at, score, passed)
select gen_random_uuid(), ('00000000-0000-0000-0000-0000000000' || p)::uuid, ('2000-01-0' || n)::date, n, now(), 12, true
  from (values ('a1', 3), ('b1', 1), ('c1', 2)) as players(p, days), generate_series(1, days) as n;
insert into public.entries (attempt_id, user_id, cycle_number, game_date)
select id, user_id, 1, game_date from public.attempts
 where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');
-- Only this test's entries in cycle 1 (the local database may hold others).
delete from public.entries where cycle_number = 1
   and user_id not in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1');

-- Players cannot draw.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_draw_tickets(1)$$, '42501', 'admins only', 'a player cannot see the tickets');
select throws_ok($$select public.admin_record_winner(1, '00000000-0000-0000-0000-0000000000a1')$$, '42501', 'admins only', 'nor record a winner');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select user_id, tickets from public.admin_draw_tickets(1)$$,
  $$values ('00000000-0000-0000-0000-0000000000a1'::uuid, 3), ('00000000-0000-0000-0000-0000000000b1'::uuid, 1)$$,
  'one ticket per drawable entry, per player in a fixed order; the flagged player has none'
);
select is(public.admin_record_winner(2, '00000000-0000-0000-0000-0000000000a1'), 'not-ready', 'a cycle still running cannot be drawn');
reset role;
update public.cycles set end_date = '2000-04-29' where number = 2;
set local role authenticated;
select is(public.admin_record_winner(2, '00000000-0000-0000-0000-0000000000a1'), 'not-ready', 'nor one that ended without the goal');
select is(public.admin_record_winner(1, '00000000-0000-0000-0000-0000000000c1'), 'not-entered', 'a winner must hold a drawable entry (not flagged)');
select is(public.admin_record_winner(1, '00000000-0000-0000-0000-0000000000ad'), 'not-entered', 'and an entry in that cycle at all');
select is(public.admin_record_winner(1, '00000000-0000-0000-0000-0000000000b1'), 'drawn', 'a won, ended cycle is drawn');
select is(public.admin_record_winner(1, '00000000-0000-0000-0000-0000000000a1'), 'already-drawn', 'and only once');
reset role;

select results_eq(
  $$select winner_user_id, drawn_at is not null from public.cycles where number = 1$$,
  $$values ('00000000-0000-0000-0000-0000000000b1'::uuid, true)$$,
  'the winner and the time are stored together'
);
select is(public.cycle_for('2000-02-01'), 1, 'setup: the cycle is unchanged otherwise');
select is((select winner_user_id from public.cycles where number = 2), null, 'the other cycles have no winner');

-- Ticket listing refuses a cycle that cannot be drawn, so nobody draws from a running one.
set local role authenticated;
select is((select count(*)::int from public.admin_draw_tickets(2)), 0, 'a cycle that cannot be drawn lists no tickets');
reset role;

select * from finish();
rollback;
