begin;
select plan(2);
-- A started game's pass target is locked on game_day_games (admin_lineups.test.sql); the day's
-- threshold stays editable on any open day, started or not (T102).
\ir fixtures/tower_lineup.psql

-- Fixtures: an admin and a player, an open day started below, no streak.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, default_pass_targets = '{"stacking": 10}';
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
select public.ensure_game_day('2000-05-11');
select tests.start('00000000-0000-0000-0000-0000000005b0', '00000000-0000-0000-0000-0000000000b0', '2000-05-11', 1);

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.game_days set survival_threshold = 0.45, edited = true where game_date = '2000-05-11'$$,
  'the threshold of a started day can still change'
);
reset role;

select is((select survival_threshold from public.game_days where game_date = '2000-05-11'), 0.45::numeric, 'and the change is kept');

select * from finish();
rollback;
