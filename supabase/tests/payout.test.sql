begin;
select plan(9);

-- Fixtures: an admin, a winner with an unconfirmed email, cycle 1 drawn, cycle 2 not drawn.
\ir fixtures/fixtures.psql
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000e9');
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-0000000000e9';
update public.cycles set start_date = '2000-01-01', end_date = '2000-02-29', goal_reached_on = '2000-01-30',
  winner_user_id = '00000000-0000-0000-0000-0000000000e9', drawn_at = now() where number = 1;
insert into public.cycles (number, start_date, end_date) values (2, '2000-03-01', '2000-04-29');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_cycle_winners()$$, '42501', 'admins only', 'a player cannot see winners');
select throws_ok($$select public.admin_mark_paid(1)$$, '42501', 'admins only', 'nor mark a prize paid');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select cycle_number, email, email_verified from public.admin_cycle_winners()$$,
  $$values (1, '00000000-0000-0000-0000-0000000000e9@example.test', false)$$,
  'each drawn cycle''s winner, with whether their email is verified'
);
select is(public.admin_mark_paid(2), 'not-drawn', 'a cycle without a winner cannot be paid');
select is(public.admin_mark_paid(1), 'paid', 'the drawn cycle is marked paid');
select is(public.admin_mark_paid(1), 'already-paid', 'once');
reset role;
select is((select paid_on from public.cycles where number = 1), public.game_date_at(now()), 'on today''s date');

update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000e9';
set local role authenticated;
select is((select email_verified from public.admin_cycle_winners() where cycle_number = 1), true, 'a confirmed email shows as verified');
select is(public.admin_mark_paid(99), 'not-drawn', 'an unknown cycle is not drawn');
reset role;

select * from finish();
rollback;
