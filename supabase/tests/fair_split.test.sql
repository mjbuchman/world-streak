begin;
\ir fixtures/fixtures.psql
select plan(7);

select results_eq(
  $$select direction from public.challenge_types where type = 'fair-split'$$,
  $$values ('higher-better')$$,
  'Fair Split is a higher-better challenge (T149)'
);
select is(
  (select (default_pass_targets ->> 'fair-split')::numeric from public.game_settings), 5::numeric,
  'its placeholder pass target is 5 shapes'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5}',
  'a fresh settings row has all five placeholders'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'fair-split',
  '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8}'::jsonb,
  'the other challenges keep their placeholders'
);
select ok(
  (select 'fair-split' = any(pool) from public.game_settings),
  'it is in the daily pool (T150)'
);

update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('fair-split', '2000-06-01', 0), 5::numeric, 'with too few scores, the target is the placeholder');

-- The T212 migration's re-target, run again on days holding an old-scale target of 4.4: only the
-- untouched one (not edited, started or closed) gets the new-scale target.
insert into public.game_days (game_date, survival_threshold, edited, closed_at, outcome)
values ('2000-06-02', 0.6, false, null, null),
       ('2000-06-03', 0.6, true, null, null),
       ('2000-06-04', 0.6, false, null, null),
       ('2000-06-05', 0.6, false, now(), 'broken');
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
select d, 1, 'fair-split', 4.4 from (values ('2000-06-02'::date), ('2000-06-03'), ('2000-06-04'), ('2000-06-05')) as days(d);
select tests.start('00000000-0000-0000-0000-0000000000c2', tests.make_player('00000000-0000-0000-0000-0000000000b2'), '2000-06-04', 1);
update public.game_day_games g
   set pass_target = public.pass_target_for('fair-split', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'fair-split' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
select results_eq(
  $$select game_date, pass_target from public.game_day_games where game_date between '2000-06-02' and '2000-06-05' order by game_date$$,
  $$values ('2000-06-02'::date, 5::numeric), ('2000-06-03'::date, 4.4::numeric), ('2000-06-04'::date, 4.4::numeric), ('2000-06-05'::date, 4.4::numeric)$$,
  'an untouched day gets 5 shapes; edited, started and closed days keep their targets (T212)'
);

select * from finish();
rollback;
