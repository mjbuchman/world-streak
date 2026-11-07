-- One profile per account: the eligibility details given at sign-up plus fields the server
-- manages (admin rights, attempt weighting, cheat flag). The auth provider stays in auth.users.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  birth_date date not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  is_admin boolean not null default false,
  weight numeric not null default 1 check (weight >= 0),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Players may read their own profile. There are deliberately no insert, update or delete
-- policies: every write goes through server code using the service role, so players can
-- never grant themselves admin rights, change their weight or clear a flag.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
