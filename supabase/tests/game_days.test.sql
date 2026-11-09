begin;
select plan(61);

-- game_days: structure.
select has_table('public', 'game_days', 'game_days table exists');
select col_is_pk('public', 'game_days', 'game_date', 'game_date is the primary key');
select col_type_is('public', 'game_days', 'game_date', 'date', 'game_date is a date');
select col_not_null('public', 'game_days', 'challenge_type', 'challenge_type is required');
select col_type_is('public', 'game_days', 'pass_target', 'numeric', 'pass_target is numeric');
select col_not_null('public', 'game_days', 'pass_target', 'pass_target is required');
select col_type_is('public', 'game_days', 'survival_threshold', 'numeric', 'survival_threshold is numeric');
select col_not_null('public', 'game_days', 'survival_threshold', 'survival_threshold is required');
select col_type_is('public', 'game_days', 'final_pass_rate', 'numeric', 'final_pass_rate is numeric');
select col_type_is('public', 'game_days', 'closed_at', 'timestamp with time zone', 'closed_at is timestamptz');

-- attempts: structure.
select has_table('public', 'attempts', 'attempts table exists');
select col_is_pk('public', 'attempts', 'id', 'id is the primary key');
select col_type_is('public', 'attempts', 'id', 'uuid', 'id is a uuid');
select fk_ok('public', 'attempts', 'game_date', 'public', 'game_days', 'game_date', 'game_date references game_days');
select col_type_is('public', 'attempts', 'seed', 'bigint', 'seed is a bigint, so every unsigned 32-bit value fits');
select col_not_null('public', 'attempts', 'seed', 'seed is required');
select col_type_is('public', 'attempts', 'inputs', 'jsonb', 'inputs is jsonb');
select col_type_is('public', 'attempts', 'score', 'numeric', 'score is numeric');
select col_type_is('public', 'attempts', 'passed', 'boolean', 'passed is boolean');
select col_not_null('public', 'attempts', 'started_at', 'started_at is required');
select col_default_is('public', 'attempts', 'started_at', 'now()', 'started_at defaults to now()');
select col_type_is('public', 'attempts', 'submitted_at', 'timestamp with time zone', 'submitted_at is timestamptz');
select col_is_unique('public', 'attempts', array['user_id', 'game_date'], 'one attempt per user per game date');

-- Row-level security and policies.
select ok((select relrowsecurity from pg_class where oid = 'public.game_days'::regclass), 'RLS is enabled on game_days');
select ok((select relrowsecurity from pg_class where oid = 'public.attempts'::regclass), 'RLS is enabled on attempts');
select policies_are('public', 'game_days', array['game_days_select_all'], 'game_days has only the read policy');
select policy_cmd_is('public', 'game_days', 'game_days_select_all', 'select', 'the game_days policy covers select only');
select policy_roles_are('public', 'game_days', 'game_days_select_all', array['anon', 'authenticated'], 'everyone may read game days');
select policies_are('public', 'attempts', array['attempts_select_own'], 'attempts has only the select-own policy');
select policy_cmd_is('public', 'attempts', 'attempts_select_own', 'select', 'the attempts policy covers select only');
select policy_roles_are(
  'public', 'attempts', 'attempts_select_own', array['authenticated'],
  'only signed-in users have an attempts policy'
);
select fk_ok('public', 'attempts', 'user_id', 'public', 'profiles', 'id', 'user_id references profiles');

select function_privs_are(
  'public', 'ensure_game_day', array['date'], 'service_role', array['EXECUTE'],
  'the server (service role) can call ensure_game_day'
);
select function_privs_are(
  'public', 'ensure_game_day', array['date'], 'authenticated', array[]::text[],
  'signed-in users have no EXECUTE on ensure_game_day'
);
select function_privs_are(
  'public', 'ensure_game_day', array['date'], 'anon', array[]::text[],
  'anonymous visitors have no EXECUTE on ensure_game_day'
);
select is(public.deadline_utc_hour(), 0, 'the SQL deadline hour is midnight UTC, like DEADLINE_UTC_HOUR');
select is(
  (select provolatile from pg_proc where oid = 'public.game_date_at(timestamptz)'::regprocedure),
  'i'::"char",
  'game_date_at is immutable: it never depends on the session'
);

-- Fixtures, created as the test superuser.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-00000000000a', '1990-01-01', 'US'),
  ('00000000-0000-0000-0000-00000000000b', '1991-02-02', 'US');

-- ensure_game_day: inserts the stacking defaults once, then does nothing.
select lives_ok($$select public.ensure_game_day('2026-11-08')$$, 'ensure_game_day creates a missing day');
select results_eq(
  $$select challenge_type, pass_target, survival_threshold, outcome, closed_at
    from public.game_days where game_date = '2026-11-08'$$,
  $$values ('stacking'::text, 10::numeric, 0.60::numeric, null::text, null::timestamptz)$$,
  'a new day is a stacking day with the default target and a 60% threshold, still open'
);
update public.game_days set pass_target = 12 where game_date = '2026-11-08';
select public.ensure_game_day('2026-11-08');
select is(
  (select count(*)::int from public.game_days where game_date = '2026-11-08'), 1,
  'ensure_game_day run twice leaves one row'
);
select is(
  (select pass_target from public.game_days where game_date = '2026-11-08'), 12::numeric,
  'ensure_game_day leaves an existing day untouched'
);

-- Check constraints.
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values ('2026-11-09', 'stacking', 10, 1.5)$$,
  '23514', null, 'survival_threshold must be between 0 and 1'
);
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, outcome)
    values ('2026-11-09', 'stacking', 10, 0.6, 'tied')$$,
  '23514', null, 'outcome is survived or broken'
);
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values ('2026-11-09', 'stacking', -1, 0.6)$$,
  '23514', null, 'pass_target cannot be negative'
);
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold, final_pass_rate)
    values ('2026-11-09', 'stacking', 10, 0.6, 1.2)$$,
  '23514', null, 'final_pass_rate is a fraction between 0 and 1'
);

select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-08', 4294967296)$$,
  '23514', null, 'a seed must fit in an unsigned 32-bit integer'
);
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-08', -1)$$,
  '23514', null, 'a seed cannot be negative'
);

-- One attempt per user per day, enforced by the database.
insert into public.attempts (user_id, game_date, seed) values
  ('00000000-0000-0000-0000-00000000000a', '2026-11-08', 1),
  ('00000000-0000-0000-0000-00000000000b', '2026-11-08', 2);
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-08', 3)$$,
  '23505', null, 'a second attempt for the same user and date is a unique violation'
);

-- Act as user A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  'select user_id from public.attempts',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'user A sees only their own attempt, not user B''s'
);
select is((select count(*)::int from public.game_days), 1, 'a signed-in user can read game days');
select throws_ok(
  $$insert into public.attempts (user_id, game_date, seed)
    values ('00000000-0000-0000-0000-00000000000a', '2026-11-09', 4)$$,
  '42501', null, 'a signed-in user cannot insert an attempt directly'
);
select throws_ok(
  $$insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
    values ('2026-11-10', 'stacking', 0, 0)$$,
  '42501', null, 'a signed-in user cannot create a game day'
);
select throws_ok(
  $$select public.ensure_game_day('2026-11-10')$$,
  '42501', null, 'a signed-in user cannot call ensure_game_day'
);
-- No update or delete policy, so RLS filters every row out: no error, and nothing changes
-- (checked as the superuser below).
select lives_ok(
  $$update public.attempts set passed = true, score = 999$$,
  'setup: user A tries to mark their own attempt as passed'
);
select lives_ok($$delete from public.attempts$$, 'setup: user A tries to delete their own attempt');

-- Act as an anonymous visitor.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.game_days), 1, 'an anonymous visitor can read game days');
select is_empty('select id from public.attempts', 'an anonymous visitor sees no attempts');
reset role;

select results_eq(
  $$select score, passed from public.attempts where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  $$values (null::numeric, null::boolean)$$,
  'user A''s update and delete affected 0 rows: the attempt is still there, unscored'
);

-- game_date_at mirrors gameDateAt in src/lib/gameDay.ts. The dollar-quoted fixture below must
-- equal src/lib/gameDay.fixture.json (a Vitest test in src/lib/gameDay.test.ts checks this).
create temporary table boundaries as
select (boundary ->> 'at')::timestamptz as at, (boundary ->> 'gameDate')::date as game_date
from jsonb_array_elements($fixture$[
  { "at": "2026-11-07T23:59:59.999Z", "gameDate": "2026-11-07" },
  { "at": "2026-11-08T00:00:00.000Z", "gameDate": "2026-11-08" },
  { "at": "2026-11-08T12:00:00.000Z", "gameDate": "2026-11-08" },
  { "at": "2026-11-07T19:30:00-05:00", "gameDate": "2026-11-08" },
  { "at": "2026-12-31T23:59:59.999Z", "gameDate": "2026-12-31" },
  { "at": "2027-01-01T00:00:00.000Z", "gameDate": "2027-01-01" },
  { "at": "2028-02-29T23:59:59.999Z", "gameDate": "2028-02-29" }
]$fixture$::jsonb) as boundary;

-- Each check lists any boundary that comes out wrong, so a failure names it. The session time
-- zone must not matter (a client can change it), so the checks run under UTC, UTC-8 and UTC+14.
set local timezone to 'UTC';
select is(
  (select string_agg(at::text, ', ') from boundaries where public.game_date_at(at) is distinct from game_date),
  null,
  'game_date_at matches every boundary in the shared fixture (session time zone UTC)'
);
set local timezone to 'America/Los_Angeles';
select is(
  (select string_agg(at::text, ', ') from boundaries where public.game_date_at(at) is distinct from game_date),
  null,
  'game_date_at matches every boundary in the shared fixture (session time zone UTC-8)'
);
set local timezone to 'Pacific/Kiritimati';
select is(
  (select string_agg(at::text, ', ') from boundaries where public.game_date_at(at) is distinct from game_date),
  null,
  'game_date_at matches every boundary in the shared fixture (session time zone UTC+14)'
);

select * from finish();
rollback;
