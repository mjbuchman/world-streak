-- Cheat flags (T41): the submit handler records one row per reason the checks (T40) found, and
-- any flag marks the account. A flag never changes a result or the counters; it only keeps the
-- account's entries out of the draw until an admin dismisses it (T42).

create table public.cheat_flags (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'confirmed', 'dismissed')),
  -- A resubmitted or retried recording adds nothing.
  constraint cheat_flags_one_per_reason unique (attempt_id, reason)
);
create index cheat_flags_user on public.cheat_flags (user_id);

-- Admin-only, through server code and functions: no client policies or privileges at all.
alter table public.cheat_flags enable row level security;
revoke all on public.cheat_flags from anon, authenticated;

/** Records `reasons` for an attempt (none: a no-op) and flags its player. Server only. */
create function public.record_cheat_flags(p_attempt_id uuid, p_reasons text[]) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if cardinality(p_reasons) = 0 then
    return;
  end if;
  select user_id into v_user_id from public.attempts where id = p_attempt_id;
  if not found then
    raise exception 'no attempt %', p_attempt_id;
  end if;
  insert into public.cheat_flags (user_id, attempt_id, reason)
  select v_user_id, p_attempt_id, r from unnest(p_reasons) as r
  on conflict (attempt_id, reason) do nothing;
  update public.profiles set flagged = true where id = v_user_id;
end;
$$;
revoke all on function public.record_cheat_flags(uuid, text[]) from public, anon, authenticated;
grant execute on function public.record_cheat_flags(uuid, text[]) to service_role;

-- The entries the prize draw (T43) picks from: every entry of an account that is not flagged.
-- Invoker, with no client privilege: only the server reads it.
create view public.drawable_entries with (security_invoker = true) as
  select e.id, e.user_id, e.cycle_number, e.game_date
    from public.entries e
    join public.profiles p on p.id = e.user_id
   where not p.flagged;
revoke all on public.drawable_entries from anon, authenticated;
