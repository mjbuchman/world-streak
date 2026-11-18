-- Second Sense now has 10 to 20 s targets against a 2 s bank (T202), so scores under the old 10 s
-- bank are on another scale. Its pass-target percentile reads only scores from the day after this
-- runs (UTC) on (T183 pattern, T204): today's games may still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'inner-clock';

-- The placeholder 4 stays and still means "survive all four rounds"; it is already in the settings
-- row and the column default (T183).

-- Coming Second Sense games nobody has touched (day not edited, started or closed) get a target on
-- the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('inner-clock', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'inner-clock' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
