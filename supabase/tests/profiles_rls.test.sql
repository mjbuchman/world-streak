begin;
select plan(17);

-- Shape of the table.
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'id references auth.users');
select col_type_is('public', 'profiles', 'birth_date', 'date', 'birth_date is a date');
select col_not_null('public', 'profiles', 'country', 'country is required');
select col_default_is('public', 'profiles', 'is_admin', 'false', 'is_admin defaults to false');
select col_default_is('public', 'profiles', 'weight', '1', 'weight defaults to 1');
select col_default_is('public', 'profiles', 'flagged', 'false', 'flagged defaults to false');

-- Row-level security and the single select policy.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'row-level security is enabled on profiles'
);
select policies_are('public', 'profiles', array['profiles_select_own'], 'only the select-own policy exists');
select policy_cmd_is('public', 'profiles', 'profiles_select_own', 'select', 'the policy covers select only');

-- Two users with profiles, created as the test superuser.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@example.test');
insert into public.profiles (id, birth_date, country) values
  ('00000000-0000-0000-0000-00000000000a', '1990-01-01', 'US'),
  ('00000000-0000-0000-0000-00000000000b', '1991-02-02', 'US');

select throws_ok(
  $$insert into public.profiles (id, birth_date, country)
    values ('00000000-0000-0000-0000-00000000000c', '1992-03-03', 'us')$$,
  '23514',
  null,
  'country must be an upper-case two-letter code'
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
select lives_ok(
  $$update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a'$$,
  'user A''s attempt to make themselves admin runs without error'
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
  'user A''s update affected 0 rows: is_admin is still false'
);

select * from finish();
rollback;
