begin;
select plan(59);

-- Structure and the launch defaults.
select has_table('public', 'game_settings', 'game_settings table exists');
select col_is_pk('public', 'game_settings', 'id', 'id is the primary key');
select col_type_is('public', 'game_settings', 'default_survival_threshold', 'numeric', 'default_survival_threshold is numeric');
select col_type_is('public', 'game_settings', 'pass_target_percentile', 'numeric', 'pass_target_percentile is numeric');
select col_type_is('public', 'game_settings', 'pass_target_streak_step', 'numeric', 'pass_target_streak_step is numeric');
select col_type_is('public', 'game_settings', 'threshold_streak_step', 'numeric', 'threshold_streak_step is numeric');
select col_type_is('public', 'game_settings', 'percentile_lookback_days', 'integer', 'percentile_lookback_days is an integer');
select col_type_is('public', 'game_settings', 'percentile_min_sample', 'integer', 'percentile_min_sample is an integer');
select col_type_is('public', 'game_settings', 'default_pass_targets', 'jsonb', 'default_pass_targets is jsonb');
select col_type_is('public', 'game_settings', 'new_account_weight', 'numeric', 'new_account_weight is numeric');
select col_type_is('public', 'game_settings', 'full_weight_after_days', 'integer', 'full_weight_after_days is an integer');
select results_eq(
  $$select default_survival_threshold, pass_target_percentile, pass_target_streak_step, threshold_streak_step,
      percentile_lookback_days, percentile_min_sample, default_pass_targets, new_account_weight, full_weight_after_days
    from public.game_settings$$,
  $$values (0.60::numeric, 0.80::numeric, 0::numeric, 0::numeric, 14, 50, '{"stacking": 10}'::jsonb, 1.0::numeric, 0)$$,
  'the one settings row holds the launch defaults'
);

-- One row only, enforced by the database.
select throws_ok(
  $$insert into public.game_settings default values$$,
  '23505', null, 'a second settings row is refused'
);
select throws_ok(
  $$insert into public.game_settings (id) values (false)$$,
  '23514', null, 'the single-row check refuses any other id'
);

-- Range checks.
select throws_ok(
  $$update public.game_settings set default_survival_threshold = 1.5$$,
  '23514', null, 'the survival threshold is a fraction between 0 and 1'
);
select throws_ok(
  $$update public.game_settings set pass_target_percentile = -0.1$$,
  '23514', null, 'the pass-target percentile is a fraction between 0 and 1'
);
select throws_ok(
  $$update public.game_settings set pass_target_streak_step = -1$$,
  '23514', null, 'the pass-target step cannot be negative'
);
select throws_ok(
  $$update public.game_settings set threshold_streak_step = -0.01$$,
  '23514', null, 'the threshold step cannot be negative'
);
select throws_ok(
  $$update public.game_settings set percentile_lookback_days = 0$$,
  '23514', null, 'the lookback covers at least one day'
);
select throws_ok(
  $$update public.game_settings set percentile_min_sample = 0$$,
  '23514', null, 'the percentile needs at least one score'
);
select throws_ok(
  $$update public.game_settings set new_account_weight = 1.1$$,
  '23514', null, 'a new account''s weight is between 0 and 1'
);
select throws_ok(
  $$update public.game_settings set full_weight_after_days = -1$$,
  '23514', null, 'the full-weight wait cannot be negative'
);
select throws_ok(
  $$update public.game_settings set default_pass_targets = '[10]'$$,
  '23514', null, 'default pass targets are an object keyed by challenge'
);
select throws_ok(
  $$update public.game_settings set default_pass_targets = '{}'$$,
  '23514', null, 'default pass targets must include stacking, which ensure_game_day reads'
);
select throws_ok(
  $$update public.game_settings set default_pass_targets = '{"stacking": "ten"}'$$,
  '23514', null, 'a default pass target must be a number'
);
select throws_ok(
  $$update public.game_settings set default_pass_targets = '{"stacking": -1}'$$,
  '23514', null, 'a default pass target cannot be negative'
);
select throws_ok(
  $$update public.game_settings set default_pass_targets = '{"stacking": 10, "flashCount": null}'$$,
  '23514', null, 'every challenge''s default pass target must be a number, not only stacking''s'
);
select lives_ok(
  $$update public.game_settings set default_pass_targets = '{"stacking": 10, "flashCount": 7.5}'$$,
  'default pass targets may list more challenges'
);
update public.game_settings set default_pass_targets = '{"stacking": 10}';

-- Without its row, ensure_game_day fails loudly instead of creating no day.
delete from public.game_settings;
select throws_ok(
  $$select public.ensure_game_day('2026-11-21')$$,
  'P0001', 'game_settings has no row', 'ensure_game_day refuses to run without the settings row'
);
insert into public.game_settings default values;

-- Row-level security and the admin helper.
select ok((select relrowsecurity from pg_class where oid = 'public.game_settings'::regclass), 'RLS is enabled on game_settings');
select policies_are(
  'public', 'game_settings', array['game_settings_select_all', 'game_settings_update_admin'],
  'game_settings has a read policy and an admin update policy, nothing else'
);
select policy_cmd_is('public', 'game_settings', 'game_settings_select_all', 'select', 'the read policy covers select');
select policy_roles_are(
  'public', 'game_settings', 'game_settings_select_all', array['anon', 'authenticated'],
  'everyone may read the settings'
);
select policy_cmd_is('public', 'game_settings', 'game_settings_update_admin', 'update', 'the admin policy covers update');
select policy_roles_are(
  'public', 'game_settings', 'game_settings_update_admin', array['authenticated'],
  'only signed-in users have an update policy'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.is_admin()'::regprocedure), true,
  'is_admin is security definer, so it can read the caller''s profile flag'
);
select function_privs_are(
  'public', 'is_admin', array[]::text[], 'authenticated', array['EXECUTE'],
  'signed-in users can call is_admin (the policy runs as them)'
);

-- Fixtures: user A is a player, user B an admin.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');
insert into public.profiles (id, birth_date, country, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', '1990-01-01', 'US', false),
  ('00000000-0000-0000-0000-00000000000b', '1991-02-02', 'US', true);

-- ensure_game_day takes a new day's defaults from the settings. Recent scores from local dev runs
-- must not set the target here (T22 tests that), so none count as enough.
update public.game_settings set default_survival_threshold = 0.55, default_pass_targets = '{"stacking": 12}',
  percentile_min_sample = 2147483647;
select public.ensure_game_day('2026-11-20');
select results_eq(
  $$select challenge_type, pass_target, survival_threshold from public.game_days where game_date = '2026-11-20'$$,
  $$values ('stacking'::text, 12::numeric, 0.55::numeric)$$,
  'a new game day takes its pass target and survival threshold from game_settings'
);
update public.game_settings set default_survival_threshold = 0.60, default_pass_targets = '{"stacking": 10}';
select public.ensure_game_day('2026-11-20');
select results_eq(
  $$select pass_target, survival_threshold from public.game_days where game_date = '2026-11-20'$$,
  $$values (12::numeric, 0.55::numeric)$$,
  'changing the settings leaves an existing game day as it was'
);

-- Act as user A, a player.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_admin(), false, 'is_admin is false for a player');
select is((select count(*)::int from public.game_settings), 1, 'a player can read the settings');
-- No error, but RLS filters the row out; each check right after shows nothing changed.
select lives_ok(
  $$update public.game_settings set default_survival_threshold = 0.10$$,
  'setup: a player tries to lower the survival threshold'
);
select is(
  (select default_survival_threshold from public.game_settings), 0.60::numeric,
  'a player''s update affected 0 rows: the threshold is still 60%'
);
select throws_ok(
  $$insert into public.game_settings (id) values (true)$$,
  '42501', null, 'a player cannot insert settings'
);
select lives_ok($$delete from public.game_settings$$, 'setup: a player tries to delete the settings row');
select is((select count(*)::int from public.game_settings), 1, 'a player''s delete affected 0 rows');

-- Act as user B, an admin.
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_admin(), true, 'is_admin is true for an admin');
select lives_ok(
  $$update public.game_settings set default_survival_threshold = 0.65$$,
  'an admin can update the settings'
);
select is(
  (select default_survival_threshold from public.game_settings), 0.65::numeric,
  'the admin''s update took effect'
);
select lives_ok($$delete from public.game_settings$$, 'setup: an admin tries to delete the settings row');
select is((select count(*)::int from public.game_settings), 1, 'an admin''s delete affected 0 rows');
select throws_ok(
  $$insert into public.game_settings (id) values (true)$$,
  '42501', null, 'even an admin cannot insert settings'
);

-- Act as an anonymous visitor.
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public.is_admin(), false, 'is_admin is false for an anonymous visitor');
select is((select count(*)::int from public.game_settings), 1, 'an anonymous visitor can read the settings');
select lives_ok(
  $$update public.game_settings set default_survival_threshold = 0.10$$,
  'setup: an anonymous visitor tries to lower the survival threshold'
);
select is(
  (select default_survival_threshold from public.game_settings), 0.65::numeric,
  'an anonymous visitor''s update affected 0 rows'
);
reset role;

-- As the superuser: only the admin's change landed, and nobody could delete the row (there is
-- no delete policy, not even for admins).
select results_eq(
  $$select count(*)::int, min(default_survival_threshold) from public.game_settings$$,
  $$values (1, 0.65::numeric)$$,
  'one row remains, with the admin''s value: the player''s and visitor''s updates affected 0 rows'
);
select is(
  (select public.is_admin()), false,
  'is_admin is false without a signed-in user'
);
select function_privs_are(
  'public', 'is_admin', array[]::text[], 'anon', array['EXECUTE'],
  'anonymous visitors can call is_admin (the read policy is evaluated for them too)'
);

select * from finish();
rollback;
