begin;
select plan(11);
-- These days start as Tower days; the rotation (T31) has its own tests in rotation.test.sql.
update public.game_settings set rotation = '{stacking}';

-- Fixtures: an admin and a player; an unstarted, a started and a closed day; no streak.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0,
  default_pass_targets = '{"stacking": 10, "inner-clock": 0.5, "flash-count": 20}';
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
select public.ensure_game_day(d) from (values ('2000-06-09'::date), ('2000-06-10'), ('2000-06-11')) as days(d);
update public.game_days set closed_at = now(), outcome = 'broken' where game_date = '2000-06-09';
select tests.start('00000000-0000-0000-0000-0000000006b0', '00000000-0000-0000-0000-0000000000b0', '2000-06-11', 1);

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.game_days set challenge_type = 'flash-count', edited = true where game_date = '2000-06-10'$$,
  'an admin can change the challenge of an open day nobody has started'
);
select throws_ok(
  $$update public.game_days set challenge_type = 'flash-count', edited = true where game_date = '2000-06-11'$$,
  'WS003', 'game day 2000-06-11 has started, so its challenge is locked',
  'once a player has started, the challenge cannot change'
);
select throws_ok(
  $$update public.game_days set challenge_type = 'no-such-game', edited = true where game_date = '2000-06-10'$$,
  'P0001', 'unknown challenge type no-such-game', 'only a known challenge type'
);
select throws_ok(
  $$update public.game_days set challenge_type = 'inner-clock', edited = false where game_date = '2000-06-10'$$,
  '42501', null, 'a challenge change must mark the day edited'
);
update public.game_days set challenge_type = 'inner-clock', edited = true where game_date = '2000-06-09';
reset role;

select results_eq(
  $$select game_date, challenge_type, pass_target, edited from public.game_days where game_date between '2000-06-09' and '2000-06-11' order by game_date$$,
  $$values ('2000-06-09'::date, 'stacking', 10::numeric, false),
           ('2000-06-10'::date, 'flash-count', 20::numeric, true),
           ('2000-06-11'::date, 'stacking', 10::numeric, false)$$,
  'the unstarted day took the new challenge and its default target; the closed and started days did not change'
);

-- As a player.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
set local role authenticated;
update public.game_days set challenge_type = 'inner-clock', edited = true where game_date = '2000-06-10';
reset role;
select is((select challenge_type from public.game_days where game_date = '2000-06-10'), 'flash-count', 'a player''s change does nothing');

-- An edited day keeps its challenge when the automatic preparation runs again.
select public.ensure_game_day('2000-06-10');
select is((select challenge_type from public.game_days where game_date = '2000-06-10'), 'flash-count', 'the rotation leaves the edited day alone');

-- The target follows the new type until edited: a later edit of the target alone sticks.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
update public.game_days set pass_target = 25, edited = true where game_date = '2000-06-10';
select is((select pass_target from public.game_days where game_date = '2000-06-10'), 25::numeric, 'a target edit after the change sticks');
-- A change that repeats the current target takes the new type's default; one naming a new target keeps it.
update public.game_days set challenge_type = 'stacking', pass_target = 25, edited = true where game_date = '2000-06-10';
select is((select pass_target from public.game_days where game_date = '2000-06-10'), 10::numeric, 'an unchanged target becomes the new challenge''s default');
update public.game_days set challenge_type = 'inner-clock', pass_target = 0.8, edited = true where game_date = '2000-06-10';
select is((select pass_target from public.game_days where game_date = '2000-06-10'), 0.8::numeric, 'a target set in the same change is kept');
reset role;

-- Not only admins: the lock is on the table, so the service role cannot change a started day either.
set local role service_role;
select throws_ok(
  $$update public.game_days set challenge_type = 'inner-clock' where game_date = '2000-06-11'$$,
  'WS003', null, 'the service role cannot change a started day''s challenge'
);
reset role;

select * from finish();
rollback;
