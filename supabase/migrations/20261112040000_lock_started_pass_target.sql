-- A started day's pass target is locked (T102): once anyone has started a day, every player is
-- judged by the same target, whoever edits the day (admins and the service role included). The
-- threshold stays editable on any open day.

create or replace function public.lock_started_pass_target()
returns trigger
language plpgsql
-- Definer: an admin's row-level security shows only their own attempts, and the check must see all.
security definer
set search_path = ''
as $$
begin
  -- An attempt start share-locks the day row first, so it and this update never interleave: the
  -- check below sees every start that committed before this update got the row.
  if new.pass_target is distinct from old.pass_target
     and exists (select 1 from public.attempts where game_date = old.game_date) then
    raise exception 'game day % has started, so its pass target is locked', old.game_date
      using errcode = 'WS002';
  end if;
  return new;
end;
$$;
revoke execute on function public.lock_started_pass_target() from public, anon, authenticated;

create trigger game_days_lock_started_pass_target
  before update of pass_target on public.game_days
  for each row execute function public.lock_started_pass_target();
