-- Admins review cheat flags (T124). Both functions check `is_admin()` for the caller, so the
-- admin page uses the admin's own session, never the service role.

/** The open flags, oldest first, with the player's email, the day and the attempt's score. */
create function public.admin_open_flags()
returns table (flag_id bigint, email text, reason text, created_at timestamptz, game_date date, score numeric)
language plpgsql
stable
-- Definer: flags and auth.users are closed to clients; the admin check below guards them.
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select f.id, u.email::text, f.reason, f.created_at, a.game_date, a.score
      from public.cheat_flags f
      join public.attempts a on a.id = f.attempt_id
      join auth.users u on u.id = f.user_id
     where f.status = 'open'
     order by f.created_at, f.id;
end;
$$;
revoke all on function public.admin_open_flags() from public, anon;
grant execute on function public.admin_open_flags() to authenticated;

/**
 * Dismisses or confirms one open flag. Dismissing the player's last open or confirmed flag
 * clears their account's flag, so their entries return to the draw; confirming keeps it
 * flagged. Returns the new status, or 'not-found' for a flag that is missing or already
 * reviewed (a stale page must not turn a confirmed flag into a dismissed one).
 */
create function public.review_cheat_flag(p_flag_id bigint, p_decision text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_decision not in ('dismissed', 'confirmed') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;

  update public.cheat_flags set status = p_decision
   where id = p_flag_id and status = 'open'
  returning user_id into v_user_id;
  if not found then
    return 'not-found';
  end if;
  -- Locked, so two admins reviewing this player's flags at once see each other's decisions.
  perform 1 from public.profiles where id = v_user_id for update;
  update public.profiles
     set flagged = exists (
       select 1 from public.cheat_flags where user_id = v_user_id and status in ('open', 'confirmed')
     )
   where id = v_user_id;
  return p_decision;
end;
$$;
revoke all on function public.review_cheat_flag(bigint, text) from public, anon;
grant execute on function public.review_cheat_flag(bigint, text) to authenticated;
