begin;
select plan(12);

-- Fixtures: an admin and a player with one passed attempt, an entry and two open flags.
\ir fixtures/fixtures.psql
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000c1');
select tests.play_day('2000-03-05', 0, 0);
insert into public.attempts (id, user_id, game_date, seed, submitted_at, score, passed)
values ('00000000-0000-0000-0000-0000000c1001', '00000000-0000-0000-0000-0000000000c1', '2000-03-05', 1, now(), 12, true);
insert into public.entries (attempt_id, user_id, cycle_number, game_date)
values ('00000000-0000-0000-0000-0000000c1001', '00000000-0000-0000-0000-0000000000c1', 1, '2000-03-05');
select public.record_cheat_flags('00000000-0000-0000-0000-0000000c1001', array['stacking-min-interval', 'timing-mismatch']);
create temp table flag_ids as select id, reason from public.cheat_flags;
grant select on flag_ids to authenticated;

-- As a player: no list, no review.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_open_flags()$$, '42501', 'admins only', 'a player cannot list flags');
select throws_ok(
  $$select public.review_cheat_flag((select id from flag_ids limit 1), 'dismissed')$$,
  '42501', 'admins only', 'nor review one'
);
reset role;

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select email, reason, game_date, score from public.admin_open_flags()$$,
  $$values ('00000000-0000-0000-0000-0000000000c1@example.test', 'stacking-min-interval', '2000-03-05'::date, 12::numeric),
           ('00000000-0000-0000-0000-0000000000c1@example.test', 'timing-mismatch', '2000-03-05'::date, 12::numeric)$$,
  'the admin sees each open flag with the player''s email, the day and the score'
);
select throws_ok(
  $$select public.review_cheat_flag((select id from flag_ids limit 1), 'deleted')$$,
  '22023', 'unknown decision deleted', 'only dismissed or confirmed'
);
select is(public.review_cheat_flag(-1, 'dismissed'), 'not-found', 'an unknown flag is reported, not an error');
select is(
  public.review_cheat_flag((select id from flag_ids where reason = 'stacking-min-interval'), 'dismissed'), 'dismissed',
  'dismissing one flag'
);
reset role;
select is((select flagged from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), true, 'keeps the account flagged while another is open');
select is((select count(*)::int from public.drawable_entries where user_id = '00000000-0000-0000-0000-0000000000c1'), 0, 'so its entry stays out of the draw');

set local role authenticated;
select is(public.review_cheat_flag((select id from flag_ids where reason = 'timing-mismatch'), 'dismissed'), 'dismissed', 'dismissing the last one');
reset role;
select is((select flagged from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), false, 'clears the account''s flag');
select is((select count(*)::int from public.drawable_entries where user_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'and its entry is back in the draw');

-- Confirming keeps (or puts) the account flagged, and a confirmed flag is no longer listed as open.
set local role authenticated;
select public.review_cheat_flag((select id from flag_ids where reason = 'timing-mismatch'), 'confirmed');
reset role;
select is((select flagged from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'), true, 'a confirmed flag keeps the account flagged');

select * from finish();
rollback;
