begin;
select plan(15);

-- close_game_day refuses days before their deadline, so cycle 1 moves to the past for these
-- tests: 2000-01-01 to 2000-02-29 is 60 days too (a leap year), as 2027-01-01 to 2027-03-01 is.
\ir fixtures/fixtures.psql
update public.game_settings set rotation = '{stacking}', percentile_min_sample = 2147483647;
update public.game_days set closed_at = now(), outcome = 'broken' where closed_at is null and game_date < '1999-12-30';
delete from public.streak_runs;
update public.cycles set start_date = '2000-01-01', end_date = '2000-02-29' where number = 1;

-- Plays and closes `n` days from `first`, each with 10 attempts and `passes` passes (6+ survives).
create function tests.run_days(first date, n integer, passes integer) returns void
language plpgsql as $$
begin
  for i in 0 .. n - 1 loop
    perform tests.play_day(first + i, 10, passes);
    perform public.close_game_day(first + i);
  end loop;
end;
$$;

-- Preseason: two survived days make a run, which counts for the display but not the goal.
select tests.run_days('1999-12-30', 2, 9);
select is((select current from public.world_streak()), 2, 'setup: a preseason run of 2');

-- Cycle 1: the first day starts a fresh run; 28 survived, day 29 broken, then 30 survived.
select tests.run_days('2000-01-01', 1, 9);
select results_eq(
  $$select start_date, end_date, length from public.streak_runs order by start_date$$,
  $$values ('1999-12-30'::date, '1999-12-31'::date, 2), ('2000-01-01'::date, null::date, 1)$$,
  'the first day of a cycle ends the run from before it and starts a new one'
);
select tests.run_days('2000-01-02', 27, 9);
select tests.run_days('2000-01-29', 1, 0);
select tests.run_days('2000-01-30', 29, 9);
select is((select goal_reached_on from public.cycles where number = 1), null, 'a run of 29 has not reached the goal');
select tests.run_days('2000-02-28', 1, 9);
select is((select goal_reached_on from public.cycles where number = 1), '2000-02-28'::date, 'broken on day 29, then 30 survived days reach it on day 59');
select is((select count(*)::int from public.cycles where number = 2), 0, 'the next cycle waits for the last day');

-- Day 60 closes the cycle: the next one starts the day after, 60 days long, and a won cycle rolls nothing over.
select tests.run_days('2000-02-29', 1, 9);
select is((select goal_reached_on from public.cycles where number = 1), '2000-02-28'::date, 'the goal keeps its first date as the cycle runs on');
select results_eq(
  $$select start_date, end_date, base_prize_cents, rollover_in_cents from public.cycles where number = 2$$,
  $$values ('2000-03-01'::date, '2000-04-29'::date, 20000, 0)$$,
  'cycle 2 follows, with no rollover after a won cycle'
);

-- Re-closing a day changes nothing.
create temp table before_rerun as select * from public.streak_runs;
select is(public.close_game_day('2000-02-28'), 'survived', 're-closing a day returns its outcome');
select is(public.close_game_day('2000-02-29'), 'survived', 'and so does re-closing the last day');
select results_eq(
  $$select start_date, end_date, length from public.streak_runs order by start_date$$,
  $$select start_date, end_date, length from before_rerun order by start_date$$,
  'without touching the streak'
);
select results_eq(
  $$select number, goal_reached_on, rollover_in_cents from public.cycles order by number$$,
  $$values (1, '2000-02-28'::date, 0), (2, null::date, 0)$$,
  'or the cycles'
);

-- Cycle 2: the 31-day run from cycle 1 does not carry over, so 30 survived days reach the goal on day 30.
select tests.run_days('2000-03-01', 29, 9);
select is((select goal_reached_on from public.cycles where number = 2), null, 'the run restarts at the cycle start');
select tests.run_days('2000-03-30', 1, 9);
select is((select goal_reached_on from public.cycles where number = 2), '2000-03-30'::date, '30 survived days from the start reach it on day 30');

-- Then 30 broken days end cycle 2; cycle 3 also has no 30-day run, so cycle 4 gets its prize.
select tests.run_days('2000-03-31', 30, 0);
select tests.run_days('2000-04-30', 60, 0);
select results_eq(
  $$select number, rollover_in_cents, base_prize_cents + rollover_in_cents from public.cycles where number in (3, 4) order by number$$,
  $$values (3, 0, 20000), (4, 20000, 40000)$$,
  'an unwon cycle rolls its whole prize into the next: $400'
);
-- Cycle 4 (2000-06-29 to 2000-08-27) is not won either: its whole $400 rolls on, base and rollover.
select tests.run_days('2000-06-29', 60, 0);
select results_eq(
  $$select rollover_in_cents, base_prize_cents + rollover_in_cents from public.cycles where number = 5$$,
  $$values (40000, 60000)$$,
  'a second unwon cycle in a row makes the next one $600'
);

select * from finish();
rollback;
