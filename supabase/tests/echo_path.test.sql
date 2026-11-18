begin;
\ir fixtures/fixtures.psql
select plan(7);

select results_eq(
  $$select direction from public.challenge_types where type = 'echo-path'$$,
  $$values ('higher-better')$$,
  'Echo Path is a higher-better challenge (T145)'
);
select is(
  (select (default_pass_targets ->> 'echo-path')::numeric from public.game_settings), 8::numeric,
  'its placeholder pass target is a path of 8 tiles, the 5 x 8 board''s height (T191, T209)'
);
select col_default_is(
  'public', 'game_settings', 'default_pass_targets', '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "echo-path": 8, "fair-split": 5}',
  'a fresh settings row has its placeholder (and those added since)'
);
select ok(
  (select 'echo-path' = any(pool) from public.game_settings),
  'it is in the daily pool (T150)'
);

update public.game_settings set percentile_min_sample = 2147483647, pass_target_streak_step = 0;
select is(public.pass_target_for('echo-path', '2000-06-01', 0), 8::numeric, 'with too few scores, the target is the placeholder');

-- The migrations' re-target (T191, T209), run again on days still holding an old-scale target: only the
-- untouched one (not edited, started or closed) gets the new placeholder.
insert into public.game_days (game_date, survival_threshold, edited, closed_at, outcome)
values ('2000-06-02', 0.6, false, null, null),
       ('2000-06-03', 0.6, true, null, null),
       ('2000-06-04', 0.6, false, null, null),
       ('2000-06-05', 0.6, false, now(), 'broken');
insert into public.game_day_games (game_date, position, challenge_type, pass_target)
select d, 1, 'echo-path', 6 from (values ('2000-06-02'::date), ('2000-06-03'), ('2000-06-04'), ('2000-06-05')) as days(d);
select tests.start('00000000-0000-0000-0000-0000000000c3', tests.make_player('00000000-0000-0000-0000-0000000000b3'), '2000-06-04', 1);
update public.game_day_games g
   set pass_target = public.pass_target_for('echo-path', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'echo-path' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
select results_eq(
  $$select game_date, pass_target from public.game_day_games where game_date between '2000-06-02' and '2000-06-05' order by game_date$$,
  $$values ('2000-06-02'::date, 8::numeric), ('2000-06-03'::date, 6::numeric), ('2000-06-04'::date, 6::numeric), ('2000-06-05'::date, 6::numeric)$$,
  'an untouched day gets a path of 8; edited, started and closed days keep their targets'
);
-- The placeholder was merged in, not swapped for the whole object.
select is(
  (select default_pass_targets from public.game_settings) - 'echo-path',
  '{"stacking": 10, "inner-clock": 4, "flash-count": 5, "fair-split": 5}'::jsonb,
  'the other challenges keep their placeholders'
);

select * from finish();
rollback;
