begin;
\ir fixtures/fixtures.psql
select plan(8);

-- T183: a challenge's pass-target percentile reads only scores from its scores_since date on.
select has_column('public', 'challenge_types', 'scores_since', 'challenge types have a scores_since date');
select ok(
  (select scores_since is not null and scores_since <= (now() at time zone 'utc')::date + 1 from public.challenge_types where type = 'inner-clock'),
  'Second Sense counts scores from at most the day after the migration ran'
);
select is(
  (select count(*)::integer from public.challenge_types where type <> 'inner-clock' and scores_since is not null), 0,
  'every other challenge still counts all its scores'
);
select is((select (default_pass_targets ->> 'inner-clock')::numeric from public.game_settings), 4::numeric, 'the placeholder stays 4: survive all four');
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets') like '%"inner-clock": 4%',
  'and a fresh settings row has it'
);

-- Scores laid out directly: the attempt triggers (counters, day results, lineup checks) are not
-- what this tests, and they roll back with the rest.
update public.game_settings set percentile_min_sample = 3, percentile_lookback_days = 14, pass_target_percentile = 0.8, pass_target_streak_step = 0;
update public.challenge_types set scores_since = '2033-01-10' where type = 'inner-clock';
insert into public.game_days (game_date, survival_threshold) values ('2033-01-05', 0.6), ('2033-01-10', 0.6), ('2033-01-11', 0.6);
select tests.make_player(('00000000-0000-0000-0000-0000000007' || lpad(n::text, 2, '0'))::uuid) from generate_series(1, 12) n;
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

-- The Tower has no scores_since: its old scores still count.
select tests.scored(n, '2033-01-05', 'stacking', 18 + 2 * n) from generate_series(10, 12) n;
select is(public.pass_target_for('stacking', '2033-01-12', 0), 38::numeric, 'other challenges keep every score in the lookback');

select * from finish();
rollback;
