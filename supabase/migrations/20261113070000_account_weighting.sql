-- Account weighting (T46): a new account's attempt counts `new_account_weight` until the account
-- is `full_weight_after_days` old, then fully; `profiles.weight` (a manual override, default 1)
-- multiplies either. The weight is stamped when the attempt starts and used for both its count
-- and its pass (T17: an attempt counts with the weight it started with), so `counted_weight` is
-- the attempt's weight. The launch defaults (1.0 after 0 days) count every account fully.

create or replace function public.stamp_attempt_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.game_settings;
begin
  select * into s from public.game_settings;
  if not found then
    raise exception 'game_settings has no row';
  end if;
  select p.weight * case
           when now() - p.created_at >= make_interval(days => s.full_weight_after_days) then 1
           else s.new_account_weight
         end
    into new.counted_weight
    from public.profiles p
   where p.id = new.user_id;
  return new;
end;
$$;
revoke all on function public.stamp_attempt_weight() from public, anon, authenticated;
