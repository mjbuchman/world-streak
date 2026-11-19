-- M8 (T221, T222): Clean Cut's shapes are now irregular blobs and polygons with a higher asymmetry
-- floor, so its scores under the old shapes are on another scale. Its pass-target percentile reads
-- only scores from the day after this runs (UTC) on (T183 pattern, T223).
update public.challenge_types set scores_since = (now() at time zone 'utc')::date + 1
 where type = 'fair-split';

-- The placeholder target stays 5, so default_pass_targets is not touched.

-- Coming Clean Cut games nobody has touched (day not edited, started or closed) get a target on the
-- new scale; a started day keeps its target, and an edited one stays as the admin set it.
update public.game_day_games g
   set pass_target = public.pass_target_for(g.challenge_type, g.game_date, (select current from public.world_streak()))
  from public.game_days d
 where d.game_date = g.game_date and g.challenge_type = 'fair-split'
   and not d.edited and d.closed_at is null
   and not exists (select 1 from public.attempts a where a.game_date = g.game_date);
