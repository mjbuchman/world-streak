begin;
select plan(8);

-- Fixtures: today's day cleared; players 2 and 8 days old, and an 8-day-old one with a manual
-- weight of 0 (profiles.weight, the override).
\ir fixtures/fixtures.psql
create temporary table today as select tests.clear_today() as d;
select tests.make_player(('00000000-0000-0000-0000-0000000000' || p)::uuid) from (values ('d2'), ('d8'), ('d0')) as players(p);
update public.profiles set created_at = now() - interval '2 days' where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set created_at = now() - interval '8 days' where id in ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000d0');
update public.profiles set weight = 0 where id = '00000000-0000-0000-0000-0000000000d0';

-- New accounts count half until they are 7 days old.
update public.game_settings set new_account_weight = 0.5, full_weight_after_days = 7;
select tests.start(('00000000-0000-0000-0000-00000000' || p || '01')::uuid, ('00000000-0000-0000-0000-0000000000' || p)::uuid, d, 1)
  from today, (values ('d2'), ('d8'), ('d0')) as players(p);
select results_eq(
  $$select user_id, counted_weight from public.attempts where game_date = (select d from today) order by user_id$$,
  $$values ('00000000-0000-0000-0000-0000000000d0'::uuid, 0::numeric),
           ('00000000-0000-0000-0000-0000000000d2'::uuid, 0.5::numeric),
           ('00000000-0000-0000-0000-0000000000d8'::uuid, 1::numeric)$$,
  'a 2-day-old account counts 0.5, an 8-day-old one 1, and a manual weight of 0 overrides'
);
select is((select weighted_attempts from public.game_day_counters where game_date = (select d from today)), 1.5::numeric, 'so the day''s weighted attempts are 1.5');

select is(public.record_attempt_result('00000000-0000-0000-0000-00000000d201', '{}', 12, true), 'recorded', 'setup: the new account passes');
select is(public.record_attempt_result('00000000-0000-0000-0000-00000000d801', '{}', 12, true), 'recorded', 'setup: the older account passes');
select is((select weighted_passes from public.game_day_counters where game_date = (select d from today)), 1.5::numeric, 'and their passes add 0.5 and 1');

-- Either side of the 7-day line (a minute's margin, as the clock runs during the test).
delete from public.game_day_counters where game_date = (select d from today);
delete from public.attempts where game_date = (select d from today);
update public.profiles set created_at = now() - interval '7 days' + interval '1 minute' where id = '00000000-0000-0000-0000-0000000000d2';
update public.profiles set created_at = now() - interval '7 days' - interval '1 minute' where id = '00000000-0000-0000-0000-0000000000d8';
select tests.start(('00000000-0000-0000-0000-00000000' || p || '03')::uuid, ('00000000-0000-0000-0000-0000000000' || p)::uuid, d, 3)
  from today, (values ('d2'), ('d8')) as players(p);
select results_eq(
  $$select user_id, counted_weight from public.attempts where game_date = (select d from today) order by user_id$$,
  $$values ('00000000-0000-0000-0000-0000000000d2'::uuid, 0.5::numeric), ('00000000-0000-0000-0000-0000000000d8'::uuid, 1::numeric)$$,
  'just short of 7 days still counts 0.5; just past it counts fully'
);

-- With the defaults (full weight from day one), every account counts 1, even a brand-new one.
delete from public.game_day_counters where game_date = (select d from today);
delete from public.attempts where game_date = (select d from today);
update public.game_settings set new_account_weight = 1, full_weight_after_days = 0;
update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000d2';
select tests.start(('00000000-0000-0000-0000-00000000' || p || '02')::uuid, ('00000000-0000-0000-0000-0000000000' || p)::uuid, d, 2)
  from today, (values ('d2'), ('d8')) as players(p);
select is((select weighted_attempts from public.game_day_counters where game_date = (select d from today)), 2::numeric, 'with the defaults every account adds 1');
select is(
  (select counted_weight from public.attempts where id = '00000000-0000-0000-0000-00000000d202'), 1::numeric,
  'even one created moments ago'
);

select * from finish();
rollback;
