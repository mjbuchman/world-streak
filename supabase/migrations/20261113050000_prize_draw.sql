-- The prize draw (T43). The app picks the winning ticket (crypto.randomInt over the tickets this
-- lists, `pickWinner`); the database checks the cycle may be drawn and stores the winner once.
-- Both functions refuse anyone but an admin, so the page uses the admin's own session.

/** Whether cycle `c` has reached its goal and ended (today's game date is after its last day). */
create function public.cycle_drawable(c public.cycles) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select c.goal_reached_on is not null and c.end_date < public.game_date_at(now());
$$;

/**
 * Each player's tickets (drawable entries) in a cycle that may be drawn, ordered by player so a
 * ticket index means the same player every time; nothing for a cycle that may not be drawn.
 */
create function public.admin_draw_tickets(p_cycle integer)
returns table (user_id uuid, tickets integer)
language plpgsql
stable
-- Definer: drawable_entries is closed to clients; the admin check guards it.
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select e.user_id, count(*)::integer
      from public.drawable_entries e
      join public.cycles c on c.number = e.cycle_number
     where e.cycle_number = p_cycle and public.cycle_drawable(c)
     group by e.user_id
     order by e.user_id;
end;
$$;
revoke all on function public.admin_draw_tickets(integer) from public, anon;
grant execute on function public.admin_draw_tickets(integer) to authenticated;

/**
 * Stores `p_user` as the cycle's winner, with the time, in one update. Returns 'drawn',
 * 'already-drawn', 'not-ready' (not won, or not ended) or 'not-entered' (no drawable entry).
 */
create function public.admin_record_winner(p_cycle integer, p_user uuid)
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
  -- Locked, so two admins drawing at once cannot both store a winner.
  select * into v_cycle from public.cycles where number = p_cycle for update;
  if not found or not public.cycle_drawable(v_cycle) then
    return 'not-ready';
  end if;
  if v_cycle.winner_user_id is not null then
    return 'already-drawn';
  end if;
  if not exists (select 1 from public.drawable_entries where cycle_number = p_cycle and user_id = p_user) then
    return 'not-entered';
  end if;
  update public.cycles set winner_user_id = p_user, drawn_at = now() where number = p_cycle;
  return 'drawn';
end;
$$;
revoke all on function public.admin_record_winner(integer, uuid) from public, anon;
grant execute on function public.admin_record_winner(integer, uuid) to authenticated;
