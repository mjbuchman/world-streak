-- M8 (T217 to T219): Second Sense's bank is 4 s instead of 2 s, Swift Sum draws 10 to 25 dots
-- instead of 10 to 30, and Trail Trace has 2 lives instead of 3, so their scores under the old rules
-- are on another scale. Their pass-target percentiles read only scores from the day after this runs
-- (UTC) on (T183 pattern, T220): today's games may still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1
 where type in ('inner-clock', 'flash-count', 'echo-path');

-- The placeholder targets stay 4, 5 and 8, so default_pass_targets is not touched.

-- Coming games of these types nobody has touched (day not edited, started or closed) get a target on
-- the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for(g.challenge_type, g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type in ('inner-clock', 'flash-count', 'echo-path')
   and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
