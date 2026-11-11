begin;
select plan(13);

select col_not_null('public', 'game_days', 'edited', 'edited is required');
select col_default_is('public', 'game_days', 'edited', 'false', 'a new day is not edited');

-- Fixtures: an admin and a player, an open and a closed day, flat steps, no streak.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, threshold_streak_step = 0.1,
  default_survival_threshold = 0.60, default_pass_targets = '{"stacking": 10}';
select tests.make_player('00000000-0000-0000-0000-0000000000ad');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
select tests.make_player('00000000-0000-0000-0000-0000000000b0');
select public.ensure_game_day('2000-04-10');
select tests.play_day('2000-04-09', 10, 8, 0.60, '2000-04-10T00:00:05Z');

-- As the admin.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$update public.game_days set pass_target = 12, survival_threshold = 0.55, edited = true where game_date = '2000-04-10'$$,
  'an admin can edit an open day''s pass target and threshold'
);
select throws_ok(
  $$update public.game_days set pass_target = 13, edited = false where game_date = '2000-04-10'$$,
  '42501', null, 'an edit must mark the day edited, so the automatic preparation leaves it alone'
);
select throws_ok(
  $$update public.game_days set challenge_type = 'stacking' where game_date = '2000-04-10'$$,
  '42501', null, 'an admin cannot change any other column'
);
update public.game_days set pass_target = 1, edited = true where game_date = '2000-04-09';
reset role;
select results_eq(
  $$select pass_target, survival_threshold, edited from public.game_days where game_date in ('2000-04-09', '2000-04-10') order by game_date$$,
  $$values (10::numeric, 0.60::numeric, false), (12::numeric, 0.55::numeric, true)$$,
  'the open day took the edit; the closed day did not'
);

-- As a player, and as a visitor.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated"}', true);
set local role authenticated;
update public.game_days set pass_target = 1, edited = true where game_date = '2000-04-10';
reset role;
select is((select pass_target from public.game_days where game_date = '2000-04-10'), 12::numeric, 'a player''s edit changes nothing');
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$update public.game_days set pass_target = 1, edited = true where game_date = '2000-04-10'$$,
  '42501', null, 'a visitor cannot edit a game day at all'
);
reset role;

-- The automatic preparation refreshes only a day nobody has edited, started or closed.
select public.ensure_game_day('2000-04-11');
select public.ensure_game_day('2000-04-12');
select tests.start('00000000-0000-0000-0000-0000000001b0', '00000000-0000-0000-0000-0000000000b0', '2000-04-12', 1);
update public.game_settings set default_survival_threshold = 0.50;
select public.ensure_game_day(d) from (values ('2000-04-09'::date), ('2000-04-10'), ('2000-04-11'), ('2000-04-12')) as days(d);
select results_eq(
  $$select game_date, survival_threshold from public.game_days where game_date between '2000-04-09' and '2000-04-12' order by game_date$$,
  $$values ('2000-04-09'::date, 0.60::numeric), ('2000-04-10'::date, 0.55::numeric), ('2000-04-11'::date, 0.50::numeric), ('2000-04-12'::date, 0.60::numeric)$$,
  'closed, edited and started days keep their values; the untouched one follows the settings'
);

-- A day created early (as /admin does) still gets the streak as it stands at the close before it.
update public.game_settings set default_survival_threshold = 0.60;
select tests.play_day('2000-04-20', 10, 9, 0.60);
select public.ensure_game_day('2000-04-21');
select is((select survival_threshold from public.game_days where game_date = '2000-04-21'), 0.60::numeric, 'setup: created early with no streak');
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2000-04-20';
select is(public.close_game_day('2000-04-20'), 'survived', 'setup: the day before survives, a streak of 1');
select is(
  (select survival_threshold from public.game_days where game_date = '2000-04-21'), 0.70::numeric,
  'so the early day now asks 0.60 + 0.1 × 1'
);
select is((select edited from public.game_days where game_date = '2000-04-21'), false, 'and it is still not marked edited');

select * from finish();
rollback;
