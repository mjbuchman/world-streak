begin;
\ir fixtures/fixtures.psql
select plan(6);

select results_eq(
  $$select direction from public.challenge_types where type = 'inner-clock'$$,
  $$values ('higher-better')$$,
  'Second Sense: Time Bank is a higher-better challenge (T140)'
);
select is(
  (select (default_pass_targets ->> 'inner-clock')::numeric from public.game_settings), 4::numeric,
  'its placeholder pass target is 4 rounds'
);
-- The whole default is pinned in game_settings.test.sql; here only Second Sense's part of it.
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'game_settings' and column_name = 'default_pass_targets') like '%"inner-clock": 4%',
  'a fresh settings row has its placeholder'
);

-- Below the minimum sample the target is the placeholder; a higher-better step makes it bigger.
-- (The placeholder default is pinned whole in game_settings.test.sql.)
update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0.5;
select is(public.pass_target_for('inner-clock', '2000-06-01', 2), 5::numeric, 'with a streak of 2, the target rises to 5 rounds');

-- The migration's re-target, run again verbatim on days still holding a single-round target: only
-- the untouched one (not edited, started or closed) gets the target in rounds.
update public.game_settings set pass_target_streak_step = 0;
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, edited, closed_at, outcome)
values ('2000-06-02', 'inner-clock', 0.5, 0.6, false, null, null),
       ('2000-06-03', 'inner-clock', 0.5, 0.6, true, null, null),
       ('2000-06-04', 'inner-clock', 0.5, 0.6, false, null, null),
       ('2000-06-05', 'inner-clock', 0.5, 0.6, false, now(), 'broken');
select tests.start('00000000-0000-0000-0000-0000000000c1', tests.make_player('00000000-0000-0000-0000-0000000000b1'), '2000-06-04', 1);
update public.game_days g
   set pass_target = public.pass_target_for('inner-clock', g.game_date, (select current from public.world_streak()))
 where g.challenge_type = 'inner-clock' and not g.edited and g.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
select results_eq(
  $$select game_date, pass_target from public.game_days where game_date between '2000-06-02' and '2000-06-05' order by game_date$$,
  $$values ('2000-06-02'::date, 4::numeric), ('2000-06-03'::date, 0.5::numeric), ('2000-06-04'::date, 0.5::numeric), ('2000-06-05'::date, 0.5::numeric)$$,
  'an untouched day gets 4 rounds; edited, started and closed days keep their targets'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'inner-clock',
  '{"stacking": 10, "flash-count": 5}'::jsonb,
  'the other challenges keep their placeholders'
);

select * from finish();
rollback;
