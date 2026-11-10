-- The day counters become server-only (T18 quality review).
--
-- The meter hides the live pass rate and attempt count for the final hours before the deadline,
-- so a group cannot time a late wave of attempts to tip the day. That only works if nobody can
-- read the counters directly with the public anon key (it ships to every browser), so the read
-- policy from T17 goes and so do the table privileges. The meter endpoint reads them with the
-- service role and leaves the numbers out of its answer while hidden.
drop policy game_day_counters_select_all on public.game_day_counters;
revoke all on table public.game_day_counters from anon, authenticated;
