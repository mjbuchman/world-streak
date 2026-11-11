/**
 * The meter hides the live pass rate for this many hours before the deadline, so nobody can
 * time a late wave of attempts to tip the day (the design's recommended answer to its Open
 * "last-minute sniping" item; see docs/DECISIONS.md, T18).
 */
export const METER_HIDE_HOURS = 3;

/** How long a CDN may serve a meter reading before asking again (and as long again while it refreshes). */
export const METER_CACHE_SECONDS = 30;

/** How often an open, visible meter asks for a new reading. */
export const METER_POLL_SECONDS = 60;
