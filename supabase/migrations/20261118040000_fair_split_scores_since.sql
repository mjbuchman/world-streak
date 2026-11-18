-- Fair Split became five shapes against a 6-point bank (T193), so its old scores (shapes cut plus
-- lives left) are on another scale. Its pass-target percentile reads only scores from the day after
-- this runs (UTC) on, as Echo Path's does (T191): today's games may still be played under the old rules.
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1 where type = 'fair-split';

-- The placeholder 5 stays, and now means "survive all five shapes" (proposed, owner to confirm);
-- it is already in the settings row and the column default (T149).

-- Coming Fair Split games nobody has touched (day not edited, started or closed) get a target on
-- the new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for('fair-split', g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'fair-split' and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
