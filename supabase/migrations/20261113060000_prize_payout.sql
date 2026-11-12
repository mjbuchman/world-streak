-- The prize payout (T125): who won each drawn cycle, whether their email is verified (the design
-- requires it before payout), and marking the prize paid. Admin-only, through the admin's session.

/** Each drawn cycle's winner email and whether it is verified. */
create function public.admin_cycle_winners()
returns table (cycle_number integer, email text, email_verified boolean)
language plpgsql
stable
-- Definer: the winner and auth.users are closed to clients; the admin check guards them.
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select c.number, u.email::text, u.email_confirmed_at is not null
      from public.cycles c
      join auth.users u on u.id = c.winner_user_id
     order by c.number;
end;
$$;
revoke all on function public.admin_cycle_winners() from public, anon;
grant execute on function public.admin_cycle_winners() to authenticated;

/** Marks a drawn cycle's prize paid today. Returns 'paid', 'already-paid' or 'not-drawn'. */
create function public.admin_mark_paid(p_cycle integer)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  select * into v_cycle from public.cycles where number = p_cycle for update;
  if not found or v_cycle.winner_user_id is null then
    return 'not-drawn';
  end if;
  if v_cycle.paid_on is not null then
    return 'already-paid';
  end if;
  update public.cycles set paid_on = public.game_date_at(now()) where number = p_cycle;
  return 'paid';
end;
$$;
revoke all on function public.admin_mark_paid(integer) from public, anon;
grant execute on function public.admin_mark_paid(integer) to authenticated;
