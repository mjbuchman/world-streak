-- The scheduled daily close (T23): a catch-up job that pg_cron runs at the deadline and, as a
-- safety net, every 5 minutes.

-- Closes, oldest first, every game day before the one being played at `at`, then makes sure
-- that day exists. Closing a day prepares the next (T22), so after downtime one call walks
-- forward day by day until it reaches today. A no-op when nothing is due. Returns how many days
-- it closed. `at` exists for tests; the schedule always uses now().
create or replace function public.close_due_game_days(at timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := public.game_date_at(at);
  v_due date;
  v_closed integer := 0;
begin
  -- One run at a time: the deadline run and a safety-net run can start together.
  perform pg_advisory_xact_lock(hashtext('public.close_due_game_days'));
  loop
    select min(game_date) into v_due from public.game_days where closed_at is null and game_date < v_today;
    exit when v_due is null;
    perform public.close_game_day(v_due);
    v_closed := v_closed + 1;
  end loop;
  perform public.ensure_game_day(v_today);
  return v_closed;
end;
$$;

revoke all on function public.close_due_game_days(timestamptz) from public, anon, authenticated;
grant execute on function public.close_due_game_days(timestamptz) to service_role;

create extension if not exists pg_cron;

-- pg_cron runs in UTC, and the deadline is midnight UTC (public.deadline_utc_hour()).
select cron.schedule('close-due-game-days', '0 0 * * *', 'select public.close_due_game_days()');
select cron.schedule('close-due-game-days-safety-net', '*/5 * * * *', 'select public.close_due_game_days()');
