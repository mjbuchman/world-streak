-- Recount a day's counters from its attempts in one call (T129), for the local tools' "remove
-- fake players", which deletes attempts that do not uncount themselves. Locking the day row
-- first waits for any start in progress (it holds a share lock on the row while it counts, T93)
-- and holds off new ones, so an attempt started meanwhile cannot lose its count.
create function public.recount_game_day(d date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1 from public.game_days where game_date = d for update;
  -- A new statement, so it sees every start that committed before the lock.
  update public.game_day_counters c
     set attempts = s.attempts,
         passes = s.passes,
         weighted_attempts = s.weighted_attempts,
         weighted_passes = s.weighted_passes,
         updated_at = now()
    from (
      select count(*)::integer as attempts,
             (count(*) filter (where a.passed))::integer as passes,
             coalesce(sum(a.counted_weight), 0) as weighted_attempts,
             coalesce(sum(a.counted_weight) filter (where a.passed), 0) as weighted_passes
        from public.attempts a
       where a.game_date = d
    ) s
   where c.game_date = d;
end;
$$;
revoke all on function public.recount_game_day(date) from public, anon, authenticated;
grant execute on function public.recount_game_day(date) to service_role;
