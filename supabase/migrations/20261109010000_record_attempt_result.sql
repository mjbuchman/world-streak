-- Stores a scored attempt's result. The submit endpoint computes the score by replaying the
-- engine on the server; this function only writes it, atomically, and only once.
--
-- Returns 'recorded', 'already-submitted', 'day-closed' or 'not-found'. The attempt row and its
-- game day are locked first, so two simultaneous submissions cannot both record, and the close
-- job cannot close the day between the check and the write.
create or replace function public.record_attempt_result(
  p_attempt_id uuid,
  p_inputs jsonb,
  p_score numeric,
  p_passed boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_submitted_at timestamptz;
  v_closed_at timestamptz;
begin
  select a.submitted_at, d.closed_at
    into v_submitted_at, v_closed_at
    from public.attempts a
    join public.game_days d on d.game_date = a.game_date
   where a.id = p_attempt_id
     for update of a
     for share of d;

  if not found then
    return 'not-found';
  elsif v_submitted_at is not null then
    return 'already-submitted';
  elsif v_closed_at is not null then
    return 'day-closed';
  end if;

  update public.attempts
     set inputs = p_inputs, score = p_score, passed = p_passed, submitted_at = now()
   where id = p_attempt_id;
  return 'recorded';
end;
$$;

-- Server only. It runs as its owner (bypassing row-level security), so it must never be
-- callable by players. Supabase grants EXECUTE on new functions to anon and authenticated
-- directly, so revoke from those roles by name.
revoke all on function public.record_attempt_result(uuid, jsonb, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_attempt_result(uuid, jsonb, numeric, boolean) to service_role;
