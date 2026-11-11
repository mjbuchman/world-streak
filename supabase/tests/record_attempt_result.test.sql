begin;
select plan(19);

select has_function(
  'public', 'record_attempt_result', array['uuid', 'jsonb', 'numeric', 'boolean'],
  'record_attempt_result(attempt, inputs, score, passed) exists'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.record_attempt_result(uuid, jsonb, numeric, boolean)'::regprocedure),
  true,
  'it runs as its owner, so it can write attempts that players cannot'
);
select function_privs_are(
  'public', 'record_attempt_result', array['uuid', 'jsonb', 'numeric', 'boolean'], 'service_role', array['EXECUTE'],
  'the server (service role) can record results'
);
select function_privs_are(
  'public', 'record_attempt_result', array['uuid', 'jsonb', 'numeric', 'boolean'], 'authenticated', array[]::text[],
  'signed-in users cannot record results'
);
select function_privs_are(
  'public', 'record_attempt_result', array['uuid', 'jsonb', 'numeric', 'boolean'], 'anon', array[]::text[],
  'anonymous visitors cannot record results'
);

-- Fixtures. Results are only accepted for today's game date, so A's open attempt is on it (the
-- day may already exist from e2e runs, hence "on conflict"). The other days are far in the past:
-- 2000-01-01 is closed, 2000-01-03 passed its deadline but was never closed.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-00000000000a', '1990-01-01', 'US'),
  ('00000000-0000-0000-0000-00000000000b', '1991-02-02', 'US');
select public.ensure_game_day(public.game_date_at(now()));
insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold) values
  ('2000-01-01', 'stacking', 10, 0.6),
  ('2000-01-03', 'stacking', 10, 0.6);
insert into public.attempts (id, user_id, game_date, seed) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', public.game_date_at(now()), 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', '2000-01-03', 3),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', '2000-01-01', 2),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', public.game_date_at(now()), 4);
-- 2000-01-01 is closed after its attempt started: a start on a closed day is refused (T93).
update public.game_days set closed_at = '2000-01-02T00:00:05Z', outcome = 'survived' where game_date = '2000-01-01';

-- Players cannot call it, even for their own attempt.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{}', 999, true)$$,
  '42501', null,
  'a signed-in player cannot record a result for their own attempt'
);
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$select public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{}', 999, true)$$,
  '42501', null,
  'an anonymous visitor cannot record a result'
);
reset role;
select results_eq(
  $$select score, passed, submitted_at from public.attempts where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values (null::numeric, null::boolean, null::timestamptz)$$,
  'the refused calls changed nothing'
);

-- Recording a result.
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{"tapsMs":[900]}', 12, true),
  'recorded',
  'an open, unsubmitted attempt on today''s game date is recorded'
);
select results_eq(
  $$select inputs, score, passed, submitted_at is not null from public.attempts
    where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('{"tapsMs":[900]}'::jsonb, 12::numeric, true, true)$$,
  'the inputs, score, passed flag and submission time are stored together'
);

-- A second submission changes nothing.
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000a1', '{"tapsMs":[]}', 0, false),
  'already-submitted',
  'a second submission is refused'
);
select results_eq(
  $$select score, passed from public.attempts where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values (12::numeric, true)$$,
  'the first result stands'
);

-- Too late: a closed day, a day past its deadline that is not closed yet, and today once closed.
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000b1', '{"tapsMs":[900]}', 12, true),
  'day-closed',
  'an attempt on a closed day is refused'
);
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000a2', '{"tapsMs":[900]}', 12, true),
  'day-closed',
  'an attempt whose game date has passed is refused, even before the close job runs'
);
update public.game_days set closed_at = now() where game_date = public.game_date_at(now());
select is(
  public.record_attempt_result('00000000-0000-0000-0000-0000000000b2', '{"tapsMs":[900]}', 12, true),
  'day-closed',
  'once today is closed, today''s attempts are refused too'
);
select results_eq(
  $$select count(*)::int from public.attempts
    where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1',
                 '00000000-0000-0000-0000-0000000000b2')
      and (score is not null or passed is not null or submitted_at is not null)$$,
  $$values (0)$$,
  'nothing is recorded for any refused attempt'
);

select is(
  public.record_attempt_result('00000000-0000-0000-0000-00000000ffff', '{}', 0, false),
  'not-found',
  'an unknown attempt id is reported, not created'
);

-- Defined with an empty search path, so callers cannot shadow the tables it uses.
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.record_attempt_result(uuid, jsonb, numeric, boolean)'::regprocedure),
  'it pins an empty search_path'
);
select is(
  (select prorettype::regtype::text from pg_proc
   where oid = 'public.record_attempt_result(uuid, jsonb, numeric, boolean)'::regprocedure),
  'text',
  'it returns a status word'
);

select * from finish();
rollback;
