/**
 * The one global deadline: every game day closes at this hour, UTC. Midnight UTC is the design
 * doc's suggestion for its Open "exact global deadline time" item (see docs/DECISIONS.md).
 *
 * The close job runs in Postgres, so `public.deadline_utc_hour()` in the game-days migration
 * repeats this value. A shared fixture (`src/lib/gameDay.fixture.json`) is tested on both sides,
 * so change both together (the SQL side through a new migration).
 */
export const DEADLINE_UTC_HOUR = 0;
