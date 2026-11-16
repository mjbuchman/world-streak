begin;
select plan(3);

-- The rotation setting stays until T162 drops it, but nothing reads it since the lineups (T151);
-- challenge_for and the day's games are tested in lineups.test.sql.
select col_default_is(
  'public', 'game_settings', 'rotation', '{stacking,inner-clock,flash-count}'::text,
  'the rotation defaults to the three challenges'
);
select throws_ok(
  $$update public.game_settings set rotation = '{stacking,chess}'$$,
  'P0001', 'unknown challenge type chess in the rotation', 'an unknown type is refused'
);
select throws_ok(
  $$update public.game_settings set rotation = '{}'$$,
  '23514', null, 'an empty rotation is refused'
);

select * from finish();
rollback;
