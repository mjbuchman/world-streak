begin;
select plan(4);

select has_function('public', 'health_check', array[]::text[], 'health_check() exists');

select is(public.health_check(), true, 'health_check() returns true');

select function_privs_are(
  'public', 'health_check', array[]::text[], 'anon', array['EXECUTE'],
  'anon can call health_check(), because GET /api/health is public'
);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'health_check'),
  false,
  'health_check() runs with the privileges of its caller'
);

select * from finish();
rollback;
