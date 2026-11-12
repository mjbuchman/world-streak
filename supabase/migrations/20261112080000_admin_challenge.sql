-- An admin picks a coming day's challenge (T111). The existing policy already limits admin edits
-- to open days and makes them mark the day edited, so the rotation leaves it alone. A trigger,
-- like the pass-target lock (T102), refuses a change once anyone has started the day, and gives
-- the day the new challenge's default pass target unless the same update sets one (a target for
-- one challenge means nothing for another); a later edit of the target alone sticks.

grant update (challenge_type) on public.game_days to authenticated;

create function public.change_day_challenge()
returns trigger
language plpgsql
-- Definer: an admin's row-level security shows only their own attempts, and the check must see
-- all; pass_target_for is also service-role only.
security definer
set search_path = ''
as $$
declare
  v_streak integer;
begin
  if new.challenge_type is not distinct from old.challenge_type then
    return new;
  end if;
  -- An attempt start share-locks the day row first, so it and this update never interleave.
  if exists (select 1 from public.attempts where game_date = old.game_date) then
    raise exception 'game day % has started, so its challenge is locked', old.game_date
      using errcode = 'WS003';
  end if;
  -- An update that names its own target keeps it (the local tool, ensure_game_day, an admin
  -- changing both at once); otherwise the old challenge's target would not fit the new one.
  if new.pass_target is not distinct from old.pass_target then
    select current into v_streak from public.world_streak();
    new.pass_target := public.pass_target_for(new.challenge_type, new.game_date, v_streak);
  end if;
  return new;
end;
$$;
revoke execute on function public.change_day_challenge() from public, anon, authenticated;

create trigger game_days_change_challenge
  before update of challenge_type on public.game_days
  for each row execute function public.change_day_challenge();
