begin;
select plan(12);

select col_default_is(
  'public', 'game_settings', 'rotation', '{stacking,inner-clock,flash-count}'::text,
  'the rotation defaults to the three challenges'
);
select results_eq(
  $$select public.challenge_for(d) from (values ('2027-01-01'::date), ('2027-01-02'), ('2027-01-03'), ('2027-01-04'), ('2026-12-31')) as days(d)$$,
  $$values ('stacking'), ('inner-clock'), ('flash-count'), ('stacking'), ('flash-count')$$,
  'it starts on 2027-01-01 and works backwards too (positive modulo)'
);
-- 2026-11-12 is 50 days before 2027-01-01, and -50 mod 3 = 1.
select is(public.challenge_for('2026-11-12'), 'inner-clock', 'any date''s place in the rotation is a pure function of the date');

-- Anyone may ask (the home page and /play read it before the day exists).
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.challenge_for('2027-01-02'), 'inner-clock', 'a visitor can read the rotation');
reset role;

-- The rotation only names known challenges.
select throws_ok(
  $$update public.game_settings set rotation = '{stacking,chess}'$$,
  'P0001', 'unknown challenge type chess in the rotation', 'an unknown type is refused'
);
select throws_ok(
  $$update public.game_settings set rotation = '{}'$$,
  '23514', null, 'an empty rotation is refused'
);

-- The day's preparation follows the rotation: type, and that type's target.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0,
  default_pass_targets = '{"stacking": 10, "inner-clock": 0.5, "flash-count": 15}';
select public.ensure_game_day(d) from (values ('2027-01-01'::date), ('2027-01-02'), ('2027-01-03')) as days(d);
select results_eq(
  $$select game_date, challenge_type, pass_target from public.game_days where game_date between '2027-01-01' and '2027-01-03' order by game_date$$,
  $$values ('2027-01-01'::date, 'stacking'::text, 10::numeric), ('2027-01-02'::date, 'inner-clock'::text, 0.5::numeric), ('2027-01-03'::date, 'flash-count'::text, 15::numeric)$$,
  'each new day gets its rotation challenge and that challenge''s target'
);

-- A day created early with the old challenge follows the rotation until edited or started.
update public.game_days set challenge_type = 'stacking', pass_target = 10 where game_date = '2027-01-02';
select public.ensure_game_day('2027-01-02');
select results_eq(
  $$select challenge_type, pass_target from public.game_days where game_date = '2027-01-02'$$,
  $$values ('inner-clock'::text, 0.5::numeric)$$,
  'an untouched early day is brought into the rotation'
);
update public.game_days set challenge_type = 'flash-count', pass_target = 20, edited = true where game_date = '2027-01-02';
select public.ensure_game_day('2027-01-02');
select results_eq(
  $$select challenge_type, pass_target from public.game_days where game_date = '2027-01-02'$$,
  $$values ('flash-count'::text, 20::numeric)$$,
  'an admin-edited future day keeps its type'
);

-- The close prepares the next day by the rotation too (a past day, so it may close).
select tests.play_day('2000-07-10', 10, 8, 0.6);
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2000-07-10';
delete from public.game_days where game_date = '2000-07-11';
select is(public.close_game_day('2000-07-10'), 'survived', 'setup: the day closes');
-- 2000-07-11 is 9670 days before 2027-01-01, and -9670 mod 3 = 2.
select is((select challenge_type from public.game_days where game_date = '2000-07-11'), 'flash-count', 'the next day was prepared as the rotation says');

-- A different rotation takes effect for days not yet prepared.
update public.game_settings set rotation = '{flash-count}';
select is(public.challenge_for('2027-01-01'), 'flash-count', 'a one-challenge rotation gives that challenge every day');

select * from finish();
rollback;
