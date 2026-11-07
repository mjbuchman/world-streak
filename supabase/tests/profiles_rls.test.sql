begin;
select plan(35);

-- Table, key and foreign key.
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'id references auth.users');
select is(
  (select confdeltype from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'f'),
  'c'::"char",
  'the auth.users foreign key cascades on delete'
);

-- Column types.
select col_type_is('public', 'profiles', 'birth_date', 'date', 'birth_date is a date');
select col_type_is('public', 'profiles', 'country', 'text', 'country is text');
select col_type_is('public', 'profiles', 'is_admin', 'boolean', 'is_admin is boolean');
select col_type_is('public', 'profiles', 'weight', 'numeric', 'weight is numeric, so fractional weights work');
select col_type_is('public', 'profiles', 'flagged', 'boolean', 'flagged is boolean');
select col_type_is('public', 'profiles', 'created_at', 'timestamp with time zone', 'created_at is timestamptz');

-- Required columns.
select col_not_null('public', 'profiles', 'birth_date', 'birth_date is required');
select col_not_null('public', 'profiles', 'country', 'country is required');
select col_not_null('public', 'profiles', 'is_admin', 'is_admin is required');
select col_not_null('public', 'profiles', 'weight', 'weight is required');
select col_not_null('public', 'profiles', 'flagged', 'flagged is required');
select col_not_null('public', 'profiles', 'created_at', 'created_at is required');

-- Defaults.
select col_default_is('public', 'profiles', 'is_admin', 'false', 'is_admin defaults to false');
select col_default_is('public', 'profiles', 'weight', '1', 'weight defaults to 1');
select col_default_is('public', 'profiles', 'flagged', 'false', 'flagged defaults to false');
select col_default_is('public', 'profiles', 'created_at', 'now()', 'created_at defaults to now()');

-- Row-level security and the single select policy.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'row-level security is enabled on profiles'
);
select policies_are('public', 'profiles', array['profiles_select_own'], 'only the select-own policy exists');
select policy_cmd_is('public', 'profiles', 'profiles_select_own', 'select', 'the policy covers select only');
select policy_roles_are(
  'public', 'profiles', 'profiles_select_own', array['authenticated'],
  'the policy applies to authenticated users only'
);

-- Fixtures, created as the test superuser: A and B get profiles; C is used for the
-- constraint checks and the blocked insert.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-00000000000a', '1990-01-01', 'US'),
  ('00000000-0000-0000-0000-00000000000b', '1991-02-02', 'US');

-- Check constraints.
select throws_ok(
  $$insert into public.profiles (id, birth_date, country)
    values ('00000000-0000-0000-0000-00000000000c', '1992-03-03', 'us')$$,
  '23514', null,
  'country must be an upper-case two-letter code'
);
select throws_ok(
  $$insert into public.profiles (id, birth_date, country, weight)
    values ('00000000-0000-0000-0000-00000000000c', '1992-03-03', 'US', -1)$$,
  '23514', null,
  'weight cannot be negative'
);

-- Act as user A.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select results_eq(
  'select id from public.profiles',
  $$values ('00000000-0000-0000-0000-00000000000a'::uuid)$$,
  'user A sees only their own profile'
);
select is_empty(
  $$select id from public.profiles where id = '00000000-0000-0000-0000-00000000000b'$$,
  'user A cannot select user B''s profile'
);
select throws_ok(
  $$insert into public.profiles (id, birth_date, country)
    values ('00000000-0000-0000-0000-00000000000c', '1992-03-03', 'US')$$,
  '42501', null,
  'an authenticated user cannot insert a profile directly'
);
-- Setup for the "affects 0 rows" check below: RLS silently filters the row out.
select lives_ok(
  $$update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  'setup: user A tries to make themselves admin (no error, filtered by RLS)'
);
select lives_ok(
  $$update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000b'$$,
  'setup: user A tries to make user B admin (no error, filtered by RLS)'
);

-- Act as an anonymous visitor.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is_empty('select id from public.profiles', 'anon selects no profiles');

-- Back to the superuser to check what actually changed.
reset role;
select is(
  (select is_admin from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  false,
  'user A''s self-promotion update affected 0 rows: is_admin is still false'
);
select is(
  (select is_admin from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  false,
  'user A''s update of user B affected 0 rows: B is still not admin'
);

delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select is_empty(
  $$select id from public.profiles where id = '00000000-0000-0000-0000-00000000000a'$$,
  'deleting the auth user deletes their profile'
);

select * from finish();
rollback;
