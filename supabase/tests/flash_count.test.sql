begin;
\ir fixtures/fixtures.psql
select plan(6);

select results_eq(
  $$select direction from public.challenge_types where type = 'flash-count'$$,
  $$values ('higher-better')$$,
  'Swift Sum: Flash Ladder is a higher-better challenge (T142)'
);
select is(
  (select (default_pass_targets ->> 'flash-count')::numeric from public.game_settings), 5::numeric,
  'its placeholder pass target is 5 levels'
);
-- The whole default is pinned in echo_path.test.sql; here only Swift Sum's part of it.
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets') like '%"flash-count": 5,%',
  'a fresh settings row has its placeholder'
);

-- Below the minimum sample the target is the placeholder.
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('flash-count', '2000-06-01', 0), 5::numeric, 'with too few scores, the target is the placeholder');

-- The migration's re-target, run again verbatim on days still holding a percentage target: only
-- the untouched one (not edited, started or closed) gets the target in levels.
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, edited, closed_at, outcome)
values ('2000-06-02', 'flash-count', 15, 0.6, false, null, null),
       ('2000-06-03', 'flash-count', 15, 0.6, true, null, null),
       ('2000-06-04', 'flash-count', 15, 0.6, false, null, null),
       ('2000-06-05', 'flash-count', 15, 0.6, false, now(), 'broken');
select tests.start('00000000-0000-0000-0000-0000000000c2', tests.make_player('00000000-0000-0000-0000-0000000000b2'), '2000-06-04', 1);
update public.game_days g
   set pass_target = public.pass_target_for('flash-count', g.game_date, (select current from public.world_streak()))
 where g.challenge_type = 'flash-count' and not g.edited and g.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
select results_eq(
  $$select game_date, pass_target from public.game_days where game_date between '2000-06-02' and '2000-06-05' order by game_date$$,
  $$values ('2000-06-02'::date, 5::numeric), ('2000-06-03'::date, 15::numeric), ('2000-06-04'::date, 15::numeric), ('2000-06-05'::date, 15::numeric)$$,
  'an untouched day gets 5 levels; edited, started and closed days keep their targets'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'flash-count',
  '{"stacking": 10, "inner-clock": 4, "echo-path": 6, "fair-split": 5}'::jsonb,
  'the other challenges keep their placeholders'
);

select * from finish();
rollback;
