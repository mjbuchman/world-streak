begin;
select plan(4);

-- Row-level security does not cover TRUNCATE, so the client roles must not hold it (T64).
select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and privilege_type = 'TRUNCATE' and grantee in ('anon', 'authenticated')),
  0::bigint,
  'no table in public grants TRUNCATE to anon or authenticated'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.game_days', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.attempts', 'TRUNCATE'),
  'anon cannot truncate profiles, game_days or attempts'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.game_days', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.attempts', 'TRUNCATE'),
  'authenticated cannot truncate profiles, game_days or attempts'
);

-- Migrations create tables as postgres; the default privileges must leave TRUNCATE out.
create table public.revoke_truncate_probe (id int);
select ok(
  not has_table_privilege('anon', 'public.revoke_truncate_probe', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.revoke_truncate_probe', 'TRUNCATE'),
  'a table created later does not grant TRUNCATE to the client roles either'
);

select * from finish();
rollback;
