-- Game-wide settings the admin can tune without a migration. One row only: the primary key is
-- a boolean that the check pins to true, so a second row is a key or check violation.
-- The launch values are the design doc's recommendations for its Open items (see
-- docs/DECISIONS.md, T16): a 60% survival threshold, pass targets at the score 80% of recent
-- players reach, flat (0) steps as the streak grows, and full weight for new accounts.
create table public.game_settings (
  id boolean primary key default true,
  default_survival_threshold numeric not null default 0.60 check (default_survival_threshold between 0 and 1),
  pass_target_percentile numeric not null default 0.80 check (pass_target_percentile between 0 and 1),
  pass_target_streak_step numeric not null default 0 check (pass_target_streak_step >= 0),
  threshold_streak_step numeric not null default 0 check (threshold_streak_step >= 0),
  percentile_lookback_days integer not null default 14 check (percentile_lookback_days >= 1),
  percentile_min_sample integer not null default 50 check (percentile_min_sample >= 1),
  -- Keyed by challenge type. A placeholder until T22 sets targets from recent scores.
  default_pass_targets jsonb not null default '{"stacking": 10}' check (jsonb_typeof(default_pass_targets) = 'object'),
  new_account_weight numeric not null default 1.0 check (new_account_weight between 0 and 1),
  full_weight_after_days integer not null default 0 check (full_weight_after_days >= 0),
  constraint game_settings_single_row check (id)
);

insert into public.game_settings default values;

-- Whether the signed-in caller is an admin. Security definer so a policy can read the flag
-- even though players only see their own profile row; it never reveals anyone else's.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.game_settings enable row level security;

-- The settings are public (the rules page and meter can show them). Only admins may change
-- them; there are no insert or delete policies, so the one row can never be added or removed
-- by a client.
create policy game_settings_select_all on public.game_settings
  for select to anon, authenticated
  using (true);

create policy game_settings_update_admin on public.game_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- New game days now take their defaults from game_settings instead of literals. The challenge
-- stays stacking until the rotation (T31).
create or replace function public.ensure_game_day(d date)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.game_days (game_date, challenge_type, pass_target, survival_threshold)
  select d, 'stacking', (s.default_pass_targets ->> 'stacking')::numeric, s.default_survival_threshold
  from public.game_settings s
  on conflict (game_date) do nothing;
$$;

-- create or replace keeps the existing grants, but restate them so this file stands alone.
revoke all on function public.ensure_game_day(date) from public, anon, authenticated;
grant execute on function public.ensure_game_day(date) to service_role;
