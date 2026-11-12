-- Prize cycles (T33): 60 days each from 2027-01-01, a flat $200 prize plus whatever rolled in
-- from cycles nobody won. No revenue share, floor or cap (human's instruction). The values match
-- src/config/prize.ts.

create table public.cycles (
  number integer primary key check (number >= 1),
  start_date date not null unique,
  end_date date not null check (end_date >= start_date),
  base_prize_cents integer not null default 20000 check (base_prize_cents >= 0),
  rollover_in_cents integer not null default 0 check (rollover_in_cents >= 0),
  -- The first day the world streak reached the goal inside this cycle (T34).
  goal_reached_on date,
  -- Private: drawn by an admin after the cycle ends (T43).
  winner_user_id uuid references public.profiles (id),
  drawn_at timestamptz,
  paid_on date
);

insert into public.cycles (number, start_date, end_date) values (1, '2027-01-01', '2027-03-01');

-- Everyone may read every cycle except who won; writes happen only in definer functions (T34,
-- T43), so clients get no write privilege at all.
alter table public.cycles enable row level security;
create policy cycles_select_all on public.cycles for select to anon, authenticated using (true);
revoke all on public.cycles from anon, authenticated;
grant select (number, start_date, end_date, base_prize_cents, rollover_in_cents, goal_reached_on, drawn_at, paid_on)
  on public.cycles to anon, authenticated;

-- The readable columns, so clients can `select *`. Invoker: it reads with the caller's own grants.
create view public.cycles_public with (security_invoker = true) as
  select number, start_date, end_date, base_prize_cents, rollover_in_cents, goal_reached_on, drawn_at, paid_on
  from public.cycles;
grant select on public.cycles_public to anon, authenticated;

/** The number of the cycle containing `d`, or null (preseason, or a cycle not created yet). */
create function public.cycle_for(d date) returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select number from public.cycles where d between start_date and end_date;
$$;
grant execute on function public.cycle_for(date) to anon, authenticated;
