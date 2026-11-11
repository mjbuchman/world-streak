-- Local development seed data, applied by `npm run db:reset` (and a first `npx supabase start`)
-- after the migrations. Safe to apply again: `npx supabase db query -f supabase/seed.sql` (one
-- block, because that command runs a single statement).
-- LOCAL ONLY: the password below is public. A production admin is set up by hand (T50).
do $$
declare
  admin_id constant uuid := '00000000-0000-0000-0000-00000000ad01';
begin
  -- An admin account for /admin: admin@local.test, password "admin-local-only".
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
    'admin@local.test', extensions.crypt('admin-local-only', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    admin_id::text, admin_id,
    jsonb_build_object('sub', admin_id::text, 'email', 'admin@local.test', 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  insert into public.profiles (id, birth_date, country, is_admin)
  values (admin_id, '1980-01-01', 'US', true)
  on conflict (id) do update set is_admin = true;
end
$$;
