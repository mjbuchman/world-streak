-- Row-level security does not cover TRUNCATE, and Supabase's default grants give it to the
-- client roles. PostgREST cannot issue TRUNCATE, so this is defence in depth (T64).
revoke truncate on all tables in schema public from anon, authenticated;

-- Tables created later by migrations (run as postgres) leave it out too.
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
