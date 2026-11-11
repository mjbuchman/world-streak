begin;
select plan(27);

-- Structure and privileges.
select has_table('public', 'challenge_types', 'challenge_types table exists');
select results_eq(
  'select type, direction from public.challenge_types order by type',
  $$values ('stacking'::text, 'higher-better'::text)$$,
  'stacking is seeded as higher-better'
);
select ok((select relrowsecurity from pg_class where oid = 'public.challenge_types'::regclass), 'RLS is enabled on challenge_types');
select table_privs_are('public', 'challenge_types', 'anon', array['SELECT'], 'visitors can only read the challenge types');
select throws_ok(
  $$insert into public.challenge_types values ('x', 'sideways')$$,
  '23514', null, 'a direction is higher-better or lower-better'
);
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold) values ('2000-02-28', 'nope', 1, 0.6)$$,
  '23503', null, 'a game day names a known challenge type'
);
select function_privs_are('public', 'pass_target_for', array['text', 'date', 'integer'], 'anon', array[]::text[], 'visitors cannot call pass_target_for');

-- Fixtures: a small sample size, flat steps and no streak, inside this rolled-back transaction.
\ir fixtures/fixtures.psql
delete from public.streak_runs;
update public.game_settings set percentile_min_sample = 10, percentile_lookback_days = 14, pass_target_percentile = 0.80,
  pass_target_streak_step = 0, threshold_streak_step = 0, default_survival_threshold = 0.60, default_pass_targets = '{"stacking": 10}';

-- Ten scored stacking attempts on 2000-02-09, scoring 1 to 10.
select tests.play_day('2000-02-09', 0, 0, 0.60);
select tests.make_player(('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid) from generate_series(1, 12) n;
select tests.start(
  ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid,
  ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  '2000-02-09', n
) from generate_series(1, 12) n;
update public.attempts set score = seed, submitted_at = '2000-02-09T12:00:00Z' where game_date = '2000-02-09' and seed <= 10;
-- Two that must not count: a score never submitted (0, which would pull the target down to 2),
-- and a submission with no score (which would make 9 scores look like 10 below).
update public.attempts set score = 0 where id = '00000000-0000-0000-0000-000000000111';
update public.attempts set submitted_at = '2000-02-09T12:00:00Z' where id = '00000000-0000-0000-0000-000000000112';

-- The target 80% of them reached: exactly 8 of the 10 scored 3 or more, and 4 is reached by 7.
select is(public.pass_target_for('stacking', '2000-02-10', 0), 3::numeric, 'scores 1 to 10 give a target of 3');
select is(public.pass_target_for('stacking', '2000-02-10', 4), 3::numeric, 'a flat step leaves it at 3 whatever the streak');
update public.game_settings set pass_target_streak_step = 0.5;
select is(public.pass_target_for('stacking', '2000-02-10', 4), 5::numeric, 'a step of 0.5 with a streak of 4 makes it 3 + 2 = 5');
update public.game_settings set pass_target_streak_step = 0;

-- Only scores inside the lookback window count: on 2000-02-24 the 2000-02-09 scores are 15 days old.
select is(public.pass_target_for('stacking', '2000-02-23', 0), 3::numeric, 'scores 14 days back still count');
select is(public.pass_target_for('stacking', '2000-02-24', 0), 10::numeric, 'older ones do not, so the default applies');
select is(public.pass_target_for('stacking', '2000-02-09', 0), 10::numeric, 'nor do the scores of the day being prepared');

-- A lower-better challenge takes the smallest score that 80% reached or beat, and its step lowers it.
insert into public.challenge_types values ('testLower', 'lower-better');
update public.game_settings set default_pass_targets = '{"stacking": 10, "testLower": 50}', pass_target_streak_step = 0.5;
update public.game_days set challenge_type = 'testLower' where game_date = '2000-02-09';
select is(public.pass_target_for('testLower', '2000-02-10', 4), 6::numeric, 'lower is better: the 8th smallest of 1 to 10 is 8, less 0.5 × 4');
select is(public.pass_target_for('testLower', '2000-02-10', 100), 0::numeric, 'a lower-better target never drops below 0');
select is(public.pass_target_for('stacking', '2000-02-10', 0), 10::numeric, 'another challenge''s scores do not count');
select throws_ok(
  $$select public.pass_target_for('nope', '2000-02-10', 0)$$,
  'P0001', 'unknown challenge type nope', 'an unknown challenge type is refused'
);
update public.game_days set challenge_type = 'stacking' where game_date = '2000-02-09';
update public.game_settings set default_pass_targets = '{"stacking": 10}', pass_target_streak_step = 0;

-- The close prepares the next day from them, with the threshold rising with the streak.
update public.game_settings set threshold_streak_step = 0.1;
insert into public.streak_runs (start_date, length) values ('2000-02-05', 4);
select is(public.close_game_day('2000-02-09'), 'broken', 'setup: 2000-02-09 closes (no passes counted)');
select results_eq(
  $$select challenge_type, pass_target, survival_threshold, closed_at from public.game_days where game_date = '2000-02-10'$$,
  $$values ('stacking'::text, 3::numeric, 0.60::numeric, null::timestamptz)$$,
  'the close creates the next day, open, with the target from recent scores and the threshold for the new streak of 0'
);

-- With a streak, the threshold rises by the step a day, to at most 0.95.
insert into public.streak_runs (start_date, length) values ('2000-03-01', 2);
select public.ensure_game_day('2000-03-03');
select is((select survival_threshold from public.game_days where game_date = '2000-03-03'), 0.80::numeric, '0.60 + 0.1 × a streak of 2 is 0.80');
update public.streak_runs set length = 5 where end_date is null;
select public.ensure_game_day('2000-03-06');
select is((select survival_threshold from public.game_days where game_date = '2000-03-06'), 0.95::numeric, '0.60 + 0.1 × 5 is capped at 0.95');

-- With 9 scores, too few, the default target applies.
delete from public.attempts where id = '00000000-0000-0000-0000-000000000110';
select is(public.pass_target_for('stacking', '2000-02-10', 0), 10::numeric, 'with 9 scores the default target of 10 is used');

-- An existing next day (an admin's edit) is never overwritten, by the close or a re-run of it.
update public.game_days set pass_target = 99 where game_date = '2000-02-10';
select is(public.close_game_day('2000-02-09'), 'broken', 'setup: re-running the close');
select is((select pass_target from public.game_days where game_date = '2000-02-10'), 99::numeric, 'the edited next day keeps its target');

-- A survived close prepares the next day with the streak as it now stands, for both steps.
-- 2000-02-10 breaks (nobody played); 2000-02-11 survives, starting a streak of 1, and its one
-- scored attempt (10) brings the sample back to 10.
select is(public.close_game_day('2000-02-10'), 'broken', 'setup: 2000-02-10 closes');
select tests.play_day('2000-02-11', 9, 9, 0.60);
select tests.start('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '2000-02-11', 10);
update public.attempts set score = 10, submitted_at = '2000-02-11T12:00:00Z' where id = '00000000-0000-0000-0000-000000000201';
update public.game_settings set pass_target_streak_step = 0.5;
select is(public.close_game_day('2000-02-11'), 'survived', 'setup: 2000-02-11 survives');
select results_eq(
  $$select pass_target, survival_threshold from public.game_days where game_date = '2000-02-12'$$,
  $$values (3.5::numeric, 0.70::numeric)$$,
  'the next day uses the new streak of 1: target 3 + 0.5, threshold 0.60 + 0.1'
);

select * from finish();
rollback;
