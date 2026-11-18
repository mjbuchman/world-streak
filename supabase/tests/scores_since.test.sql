begin;
\ir fixtures/fixtures.psql
select plan(21);

-- T183: a challenge's pass-target percentile reads only scores from its scores_since date on.
select has_column('public', 'challenge_types', 'scores_since', 'challenge types have a scores_since date');
select ok(
  (select scores_since is not null and scores_since <= (now() at time zone 'utc')::date + 1 from public.challenge_types where type = 'inner-clock'),
  'Second Sense counts scores from at most the day after the migration ran'
);
select ok(
  (select scores_since is not null and scores_since <= (now() at time zone 'utc')::date + 1 from public.challenge_types where type = 'flash-count'),
  'Swift Sum counts scores from at most the day after its migration ran (T186)'
);
select ok(
  (select scores_since is not null and scores_since <= (now() at time zone 'utc')::date + 1 from public.challenge_types where type = 'echo-path'),
  'Echo Path counts scores from at most the day after its migration ran (T191)'
);
select ok(
  (select scores_since is not null and scores_since <= (now() at time zone 'utc')::date + 1 from public.challenge_types where type = 'fair-split'),
  'Fair Split counts scores from at most the day after its migration ran (T196)'
);
-- The M7 migration (T204) set Second Sense's date again, after the M6 games' migrations set theirs.
select ok(
  (select scores_since from public.challenge_types where type = 'inner-clock')
    >= (select scores_since from public.challenge_types where type = 'fair-split'),
  'Second Sense''s 2 s bank starts its scale again (T204)'
);
select ok(
  (select scores_since from public.challenge_types where type = 'flash-count')
    >= (select scores_since from public.challenge_types where type = 'fair-split'),
  'Swift Sum''s 10 to 30 dots start its scale again (T206)'
);
select ok(
  (select scores_since from public.challenge_types where type = 'echo-path')
    >= (select scores_since from public.challenge_types where type = 'fair-split'),
  'Trail Trace''s 5 x 8 board starts its scale again (T209)'
);
-- Clean Cut's own M7 migration ran last of the four, after Second Sense's (T204).
select ok(
  (select scores_since from public.challenge_types where type = 'fair-split')
    >= (select scores_since from public.challenge_types where type = 'inner-clock'),
  'Clean Cut''s lopsided shapes and 8 point bank start its scale again (T212)'
);
select is(
  (select count(*)::integer from public.challenge_types where type not in ('inner-clock', 'flash-count', 'echo-path', 'fair-split') and scores_since is not null), 0,
  'every other challenge still counts all its scores'
);
select is((select (default_pass_targets ->> 'inner-clock')::numeric from public.game_settings), 4::numeric, 'the placeholder stays 4: survive all four');
select is((select (default_pass_targets ->> 'flash-count')::numeric from public.game_settings), 5::numeric, 'Swift Sum''s is 5: survive all five');
select is((select (default_pass_targets ->> 'fair-split')::numeric from public.game_settings), 5::numeric, 'Clean Cut''s stays 5: survive all five (T196, T212)');
select is((select (default_pass_targets ->> 'echo-path')::numeric from public.game_settings), 8::numeric, 'Trail Trace''s is 8: a path the board''s height (T209)');
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets')
    like all (array['%"inner-clock": 4%', '%"flash-count": 5%', '%"echo-path": 8%', '%"fair-split": 5%']),
  'and a fresh settings row has all four'
);

-- Scores laid out directly: the attempt triggers (counters, day results, lineup checks) are not
-- what this tests, and they roll back with the rest.
update public.game_settings set percentile_min_sample = 3, percentile_lookback_days = 14, pass_target_percentile = 0.8, pass_target_streak_step = 0;
update public.challenge_types set scores_since = '2033-01-10' where type = 'inner-clock';
insert into public.game_days (game_date, survival_threshold) values ('2033-01-05', 0.6), ('2033-01-10', 0.6), ('2033-01-11', 0.6);
select tests.make_player(('00000000-0000-0000-0000-0000000007' || lpad(n::text, 2, '0'))::uuid) from generate_series(1, 18) n;
alter table public.attempts disable trigger user;
create function tests.scored(n integer, day date, challenge text, score numeric) returns void language sql as $$
  insert into public.attempts (user_id, game_date, seed, position, challenge_type, score, passed, submitted_at, counted_weight)
  values (('00000000-0000-0000-0000-0000000007' || lpad(n::text, 2, '0'))::uuid, day, 1, 1, challenge, score, true, now(), 1);
$$;

-- Five old-scale Second Sense scores, and two new ones: too few new ones for a percentile.
select tests.scored(n, '2033-01-05', 'inner-clock', 3 + n) from generate_series(1, 5) n;
select tests.scored(6, '2033-01-10', 'inner-clock', 4.5);
select tests.scored(7, '2033-01-10', 'inner-clock', 3.2);
select is(public.pass_target_for('inner-clock', '2033-01-11', 0), 4::numeric, 'old scores do not make up the sample: the placeholder applies');

-- Four new scores (4.9, 4.5, 3.2, 2): the 80th percentile is the 4th best. With the old five it would be 3.2.
select tests.scored(8, '2033-01-11', 'inner-clock', 4.9);
select tests.scored(9, '2033-01-11', 'inner-clock', 2);
select is(public.pass_target_for('inner-clock', '2033-01-12', 0), 2::numeric, 'the percentile is over new-scale scores only');

-- Swift Sum the same way: three old-scale scores before its date, one new one after it.
update public.challenge_types set scores_since = '2033-01-10' where type = 'flash-count';
select tests.scored(n, '2033-01-05', 'flash-count', n) from generate_series(6, 8) n;
select tests.scored(1, '2033-01-11', 'flash-count', 5.5);
select is(public.pass_target_for('flash-count', '2033-01-12', 0), 5::numeric, 'Swift Sum''s old scores do not make up the sample either');

-- And Echo Path: three old-scale paths before its date, one new one after it.
update public.challenge_types set scores_since = '2033-01-10' where type = 'echo-path';
select tests.scored(n, '2033-01-05', 'echo-path', n - 7) from generate_series(13, 15) n;
select tests.scored(2, '2033-01-11', 'echo-path', 12.333);
select is(public.pass_target_for('echo-path', '2033-01-12', 0), 8::numeric, 'Echo Path''s old scores do not make up the sample either');

-- And Fair Split: three old-scale runs before its date, one new one after it.
update public.challenge_types set scores_since = '2033-01-10' where type = 'fair-split';
select tests.scored(n, '2033-01-05', 'fair-split', n - 13) from generate_series(16, 18) n;
select tests.scored(3, '2033-01-11', 'fair-split', 5.5);
select is(public.pass_target_for('fair-split', '2033-01-12', 0), 5::numeric, 'Fair Split''s old scores do not make up the sample either');

-- The Tower has no scores_since: its old scores still count.
select tests.scored(n, '2033-01-05', 'stacking', 18 + 2 * n) from generate_series(10, 12) n;
select is(public.pass_target_for('stacking', '2033-01-12', 0), 38::numeric, 'other challenges keep every score in the lookback');

select * from finish();
rollback;
