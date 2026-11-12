begin;
select plan(19);

-- Fixtures: an admin and two players, each with one passed attempt, an entry and two open flags.
\ir fixtures/fixtures.psql
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000c1');
select tests.make_player('00000000-0000-0000-0000-0000000000c2');
select tests.play_day('2000-03-05', 0, 0);
insert into public.attempts (id, user_id, game_date, seed, submitted_at, score, passed)
values ('00000000-0000-0000-0000-0000000c1001', '00000000-0000-0000-0000-0000000000c1', '2000-03-05', 1, now(), 12, true),
       ('00000000-0000-0000-0000-0000000c2001', '00000000-0000-0000-0000-0000000000c2', '2000-03-05', 2, now(), 9, true);
insert into public.entries (attempt_id, user_id, cycle_number, game_date)
select id, user_id, 1, game_date from public.attempts where game_date = '2000-03-05';
select public.record_cheat_flags(a, array['stacking-min-interval', 'timing-mismatch'])
  from (values ('00000000-0000-0000-0000-0000000c1001'::uuid), ('00000000-0000-0000-0000-0000000c2001'::uuid)) as attempts(a);
create temp table flag_ids as select id, user_id, reason from public.cheat_flags;
grant select on flag_ids to authenticated;
create function pg_temp.flag(player text, why text) returns bigint language sql as $$
  select id from flag_ids where user_id = ('00000000-0000-0000-0000-0000000000' || player)::uuid and reason = why
$$;
create function pg_temp.flagged(player text) returns boolean language sql as $$
  select flagged from public.profiles where id = ('00000000-0000-0000-0000-0000000000' || player)::uuid
$$;
create function pg_temp.drawable(player text) returns integer language sql as $$
  select count(*)::int from public.drawable_entries where user_id = ('00000000-0000-0000-0000-0000000000' || player)::uuid
$$;

-- As a player: no list, no review.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.admin_open_flags()$$, '42501', 'admins only', 'a player cannot list flags');
select throws_ok($$select public.review_cheat_flag(pg_temp.flag('c1', 'timing-mismatch'), 'dismissed')$$, '42501', 'admins only', 'nor review one');
reset role;

-- As the admin. Every review below runs as the admin; checks run as the test's owner.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select email, reason, game_date, score from public.admin_open_flags() where email like '%c1@%'$$,
  $$values ('00000000-0000-0000-0000-0000000000c1@example.test', 'stacking-min-interval', '2000-03-05'::date, 12::numeric),
           ('00000000-0000-0000-0000-0000000000c1@example.test', 'timing-mismatch', '2000-03-05'::date, 12::numeric)$$,
  'the admin sees each open flag with the player''s email, the day and the score'
);
select throws_ok($$select public.review_cheat_flag(pg_temp.flag('c1', 'timing-mismatch'), 'deleted')$$, '22023', 'unknown decision deleted', 'only dismissed or confirmed');
select is(public.review_cheat_flag(-1, 'dismissed'), 'not-found', 'an unknown flag is reported, not an error');

-- Player c2: dismissing one flag keeps the account flagged while another is open; the last clears it.
select is(public.review_cheat_flag(pg_temp.flag('c2', 'stacking-min-interval'), 'dismissed'), 'dismissed', 'dismissing one of two open flags');
reset role;
select is(pg_temp.flagged('c2'), true, 'keeps the account flagged while another is open');
select is(pg_temp.drawable('c2'), 0, 'so its entry stays out of the draw');
set local role authenticated;
select is(public.review_cheat_flag(pg_temp.flag('c2', 'timing-mismatch'), 'dismissed'), 'dismissed', 'dismissing the last one');
reset role;
select is(pg_temp.flagged('c2'), false, 'clears the account''s flag');
select is(pg_temp.drawable('c2'), 1, 'and its entry is back in the draw');

-- Player c1: a confirmed flag outlasts the dismissal of another, and cannot be reviewed again.
set local role authenticated;
select is(public.review_cheat_flag(pg_temp.flag('c1', 'stacking-min-interval'), 'confirmed'), 'confirmed', 'confirming one flag');
select results_eq(
  $$select reason from public.admin_open_flags() where email like '%c1@%'$$,
  $$values ('timing-mismatch')$$,
  'a confirmed flag is no longer listed as open'
);
select is(public.review_cheat_flag(pg_temp.flag('c1', 'timing-mismatch'), 'dismissed'), 'dismissed', 'dismissing the other');
reset role;
select is(pg_temp.flagged('c1'), true, 'the confirmed flag keeps the account flagged');
select is(pg_temp.drawable('c1'), 0, 'and out of the draw');
set local role authenticated;
select is(
  public.review_cheat_flag(pg_temp.flag('c1', 'stacking-min-interval'), 'dismissed'), 'not-found',
  'a flag already reviewed (a stale page) cannot be reviewed again'
);
reset role;
select is(pg_temp.flagged('c1'), true, 'so the confirmed account stays flagged');
select is(
  (select status from public.cheat_flags where id = pg_temp.flag('c1', 'stacking-min-interval')), 'confirmed',
  'and the flag stays confirmed'
);

select * from finish();
rollback;
