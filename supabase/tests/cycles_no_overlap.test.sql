begin;
select plan(5);

-- Cycle 1 is 2027-01-01 to 2027-03-01 (T33).
select throws_ok(
  $$insert into public.cycles (number, start_date, end_date) values (90, '2027-03-01', '2027-04-29')$$,
  '23P01', null, 'a cycle starting on another''s last day is refused'
);
select throws_ok(
  $$insert into public.cycles (number, start_date, end_date) values (90, '2026-12-01', '2027-01-01')$$,
  '23P01', null, 'a cycle ending on another''s first day is refused'
);
select throws_ok(
  $$insert into public.cycles (number, start_date, end_date) values (90, '2027-01-10', '2027-01-20')$$,
  '23P01', null, 'a cycle inside another is refused'
);
select throws_ok(
  $$insert into public.cycles (number, start_date, end_date) values (90, '2027-03-02', '2027-04-30');
    update public.cycles set end_date = '2027-03-05' where number = 1$$,
  '23P01', null, 'and so is moving a cycle onto the next'
);

-- prepare_next_cycle's back-to-back cycle still goes in.
select public.prepare_next_cycle('2027-03-01');
select results_eq(
  $$select start_date, end_date from public.cycles where number = 2$$,
  $$values ('2027-03-02'::date, '2027-04-30'::date)$$,
  'the next cycle, from the day after the last, goes in'
);

select * from finish();
rollback;
