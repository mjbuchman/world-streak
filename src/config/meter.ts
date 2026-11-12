/**
 * The meter hides the live pass rate for this many hours before the deadline, so nobody can
 * time a late wave of attempts to tip the day (the design's Open "last-minute sniping" item).
 * 0: the meter shows until the deadline (human decision after the M2 play-test, T103; see
 * docs/DECISIONS.md). To hide it again if sniping becomes a real problem, set a whole number of
 * hours here; the endpoint, its cache times and the meter's message all follow this value.
 */
export const METER_HIDE_HOURS = 0;

/** How long a CDN may serve a meter reading before asking again (and as long again while it refreshes). */
export const METER_CACHE_SECONDS = 30;

/**
 * If the database fails, the endpoint keeps answering with the last good reading (marked stale)
 * for at most this long after it was read, then answers 503 (T48).
 */
export const METER_STALE_MAX_SECONDS = 300;

/** How often an open, visible meter asks for a new reading. */
export const METER_POLL_SECONDS = 60;
