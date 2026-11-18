begin;
select plan(34);

-- The pool (T150).
select col_default_is(
  'public', 'game_settings', 'pool', '{stacking,inner-clock,flash-count,echo-path,fair-split}'::text,
  'the pool starts with the five games'
);
select throws_ok($$update public.game_settings set pool = '{stacking,inner-clock,chess}'$$,
  'P0001', 'unknown challenge type chess in the pool', 'an unknown game is refused');
select throws_ok($$update public.game_settings set pool = '{stacking,inner-clock}'$$,
  '23514', null, 'a pool of two games is refused');
select throws_ok($$update public.game_settings set pool = '{stacking,inner-clock,flash-count,null}'$$,
  null, null, 'a null entry is refused (the trigger, before the check, sees a repeat)');
select throws_ok($$update public.game_settings set pool = '{stacking,inner-clock,stacking}'$$,
  'P0001', 'the pool names a game more than once', 'a repeated game is refused');

-- The daily seed: the first 32 bits of md5('2027-01-01') = e84e2bae...
select is(public.daily_seed('2027-01-01'), 3897437102::bigint, 'the daily seed is the date''s MD5, first 32 bits');

-- The rule. 3897437102 mod 60 = 2: lineup 2 of the default pool. Lineup 3 is the next one.
select results_eq(
  $$select public.lineup_for(d, null) from (values ('2027-01-01'::date), ('2027-01-02'), ('2027-01-03')) as days(d)$$,
  $$values ('{stacking,inner-clock,fair-split}'::text[]), ('{stacking,echo-path,flash-count}'), ('{inner-clock,flash-count,stacking}')$$,
  'fixed dates give these lineups'
);
select is(public.lineup_for('2027-01-01', '{stacking,inner-clock,fair-split}'),
  '{stacking,flash-count,inner-clock}'::text[], 'the previous day''s exact lineup gives way to the next one');
select is(public.lineup_for('2027-01-01', '{inner-clock,stacking,fair-split}'),
  '{stacking,inner-clock,fair-split}'::text[], 'the same games in another order do not count as a repeat');
select results_eq(
  $$select public.lineup_at('{a,b,c,d,e}', i) from (values (0::bigint), (1), (3), (59)) as n(i)$$,
  $$values ('{a,b,c}'::text[]), ('{a,b,d}'), ('{a,c,b}'), ('{e,d,c}')$$,
  'lineup numbers read as mixed-radix digits over the games left'
);

-- A year of days, each with the day before's lineup as `previous`.
create temp table chain as
with recursive c(d, lineup) as (
  select '2027-01-01'::date, public.lineup_for('2027-01-01', null)
  union all
  select d + 1, public.lineup_for(d + 1, lineup) from c where d < '2027-12-31'
)
select d, lineup, lag(lineup) over (order by d) as previous from c;
select is((select count(*) from chain), 365::bigint, 'setup: 365 days');
select is((select count(*) from chain where (select count(distinct g) from unnest(lineup) g) <> 3 or cardinality(lineup) <> 3),
  0::bigint, 'every lineup has three different games');
select is((select count(*) from chain where lineup = previous), 0::bigint, 'no day repeats the day before''s lineup');
select is((select count(distinct g) from chain, unnest(lineup) g), 5::bigint, 'every pool game appears');
select cmp_ok((select count(distinct lineup) from chain), '>', 40::bigint, 'the lineups vary (most of the 60 appear)');

-- A pool of exactly three: six lineups, consecutive days still differ (in order at least).
update public.game_settings set pool = '{stacking,inner-clock,flash-count}';
create temp table chain3 as
with recursive c(d, lineup) as (
  select '2027-01-01'::date, public.lineup_for('2027-01-01', null)
  union all
  select d + 1, public.lineup_for(d + 1, lineup) from c where d < '2027-12-31'
)
select d, lineup, lag(lineup) over (order by d) as previous from c;
select is((select count(*) from chain3 where lineup = previous), 0::bigint, 'with three games, consecutive days still differ');
select is((select count(distinct lineup) from chain3), 6::bigint, 'and all six orders appear');
update public.game_settings set pool = default;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.lineup_for('2027-01-01', null), '{stacking,inner-clock,fair-split}'::text[], 'a visitor can read the lineup rule');
select is(public.challenge_for('2027-01-01'), 'stacking', 'challenge_for is the rule''s first game');
select throws_ok($$insert into public.game_day_games values ('2027-01-01', 1, 'stacking', 1)$$,
  '42501', null, 'a visitor cannot write a lineup');
reset role;

-- Game-day lineups (T151).
select ok((select relrowsecurity from pg_class where oid = 'public.game_day_games'::regclass), 'RLS is enabled on game_day_games');
select policies_are('public', 'game_day_games', array['game_day_games_select_all', 'game_day_games_update_admin_open'],
  'lineups have the read policy and the admin edit policy (T161)');

\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 3, percentile_lookback_days = 14, pass_target_percentile = 0.8,
  pass_target_streak_step = 0, threshold_streak_step = 0,
  default_pass_targets = '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 6, "fair-split": 5}';
delete from public.game_days where game_date >= '2031-03-01';

-- Each game's target follows its own percentile: Tower scores 1, 2, 3 on the day before. With a
-- pool of three, every lineup holds the Tower.
update public.game_settings set pool = '{stacking,inner-clock,flash-count}';
select tests.play_day('2031-02-28', 0, 0);
select tests.make_player(('00000000-0000-0000-0000-00000000000' || n)::uuid) from generate_series(1, 3) n;
select tests.start(('00000000-0000-0000-0000-00000000010' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || n)::uuid, '2031-02-28', n)
  from generate_series(1, 3) n;
update public.attempts set score = seed, submitted_at = now() where game_date = '2031-02-28';
select public.ensure_game_day('2031-03-01');
select results_eq(
  $$select challenge_type, pass_target from public.game_day_games where game_date = '2031-03-01' order by challenge_type$$,
  $$values ('flash-count'::text, 5::numeric), ('inner-clock', 4), ('stacking', 1)$$,
  'three games, each with its own target: the Tower''s from its scores (80% reached 1), the others their defaults'
);
select is(public.lineup_of('2031-03-01'), public.lineup_for('2031-03-01', public.lineup_of('2031-02-28')), 'the lineup is the rule''s');

-- A day's rows (position, game, target) as text, to compare before and after.
create function tests.rows_of(d date) returns text
language sql as $$
  select array_agg(array[position::text, challenge_type, pass_target::text] order by position)::text
    from public.game_day_games where game_date = d;
$$;

-- Idempotent, and the next day differs.
select tests.rows_of('2031-03-01') as first_rows \gset
select public.ensure_game_day('2031-03-01');
select is(tests.rows_of('2031-03-01'), :'first_rows', 're-running leaves the same games, order and targets');
select public.ensure_game_day('2031-03-02');
select isnt(public.lineup_of('2031-03-02'), public.lineup_of('2031-03-01'), 'the next day''s lineup differs from today''s');

-- An untouched day follows the settings; an edited, started or closed one keeps its lineup.
update public.game_settings set pool = default;
select public.ensure_game_day('2031-03-02');
select is(public.lineup_of('2031-03-02'), public.lineup_for('2031-03-02', public.lineup_of('2031-03-01')), 'an untouched day follows a new pool');
select public.ensure_game_day('2031-03-03');
update public.game_days set edited = true where game_date = '2031-03-01';
select tests.start('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '2031-03-02', 1);
update public.game_days set closed_at = now(), outcome = 'broken' where game_date = '2031-03-03';
select tests.rows_of('2031-03-01') as edited_rows, tests.rows_of('2031-03-02') as started_rows, tests.rows_of('2031-03-03') as closed_rows \gset
update public.game_settings set pool = '{echo-path,fair-split,flash-count}', default_pass_targets = default_pass_targets || '{"stacking": 12, "echo-path": 9}';
select public.ensure_game_day(d) from (values ('2031-03-01'::date), ('2031-03-02'), ('2031-03-03')) as days(d);
select is(tests.rows_of('2031-03-01'), :'edited_rows', 'an edited day''s lineup and targets are never overwritten');
select is(tests.rows_of('2031-03-02'), :'started_rows', 'nor a started day''s');
select is(tests.rows_of('2031-03-03'), :'closed_rows', 'nor a closed day''s');

-- The close prepares the next day from the closing day's lineup (2031-02-28 has no open day
-- before it). Its lineup is set to the one the rule picks first for 2031-03-01, so the close
-- must pass it as `previous` to avoid a repeat.
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '2031-02-28';
delete from public.game_days where game_date = '2031-03-01';
delete from public.game_day_games where game_date = '2031-02-28';
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
select '2031-02-28', n, t, 1 from unnest(public.lineup_for('2031-03-01', null)) with ordinality as u(t, n);
select is(public.close_game_day_unchecked('2031-02-28'), 'broken', 'setup: the day closes');
select is(public.lineup_of('2031-03-01'), public.lineup_for('2031-03-01', public.lineup_of('2031-02-28')),
  'the close prepares the next day by the rule, with the closing day as previous');
select isnt(public.lineup_of('2031-03-01'), public.lineup_of('2031-02-28'), 'so it does not repeat the closing day''s lineup');
select is(
  (select count(*) from public.game_day_games where game_date = '2031-03-01' and pass_target = public.pass_target_for(challenge_type, '2031-03-01', 0)),
  3::bigint, 'each of its three games has its own target');

select * from finish();
rollback;
