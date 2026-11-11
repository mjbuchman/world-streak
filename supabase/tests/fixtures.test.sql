begin;
select plan(5);

-- The shared fixtures (fixtures/fixtures.psql) do what the other test files rely on.
\ir fixtures/fixtures.psql

select tests.make_player('00000000-0000-0000-0000-00000000000a', 0.5);
select results_eq(
  $$select p.weight, p.country from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values (0.5::numeric, 'US'::text)$$,
  'make_player creates an auth user and a profile with the given weight'
);

select is(tests.clear_today(), public.game_date_at(now()), 'clear_today returns today''s game date');
select is_empty(
  $$select 1 from public.attempts where game_date = public.game_date_at(now())
    union all select 1 from public.game_day_counters where game_date = public.game_date_at(now())$$,
  'and leaves today with no attempts and no counters'
);

select tests.play_day('2000-01-01', 10, 7, 0.75);
select results_eq(
  $$select d.survival_threshold, d.closed_at, c.attempts, c.passes, c.weighted_attempts, c.weighted_passes
    from public.game_days d join public.game_day_counters c using (game_date)
    where game_date = '2000-01-01'$$,
  $$values (0.75::numeric, null::timestamptz, 10, 7, 10::numeric, 7::numeric)$$,
  'play_day creates an open day with its threshold and full-weight counts'
);
select tests.play_day('2000-01-02', 0, 0, closed => '2000-01-03T00:00:05Z');
select is(
  (select closed_at from public.game_days where game_date = '2000-01-02'), '2000-01-03T00:00:05Z'::timestamptz,
  'play_day closes the day when asked'
);

select * from finish();
rollback;
