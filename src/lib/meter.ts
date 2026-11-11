// Client-safe: the meter UI imports these types and helpers in the browser, so Supabase is
// imported as a type only (a test checks this).
import type { SupabaseClient } from "@supabase/supabase-js";
import { METER_CACHE_SECONDS, METER_HIDE_HOURS } from "@/config/meter";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { deadlineFor, gameDateAt, HOUR_MS } from "@/lib/gameDay";

/** When the meter hides for the day closing at `closesAt`: METER_HIDE_HOURS before it. */
export function meterHiddenFrom(closesAt: Date | string): Date {
  return new Date(new Date(closesAt).getTime() - METER_HIDE_HOURS * HOUR_MS);
}

/** What the meter needs about one game day. */
export type MeterRow = {
  /** Null only before the day's row exists (no one has started yet, and the close job has not prepared it). */
  threshold: number | null;
  attempts: number;
  weightedAttempts: number;
  weightedPasses: number;
};

export type MeterBody =
  | {
      gameDate: string;
      status: "open";
      passRate: number | null;
      attempts: number;
      threshold: number | null;
      closesAt: string;
      /** Filled in by T21 (the world streak); null until then. */
      streak: null;
    }
  | { gameDate: string; status: "hidden"; threshold: number | null; closesAt: string };

/**
 * The meter at `now`. In the final METER_HIDE_HOURS before the deadline the response carries no
 * pass rate or attempt count at all; the counters themselves are server-only, so this answer is
 * the only way to read them.
 */
export function meterBody(now: Date, gameDate: string, row: MeterRow): MeterBody {
  const deadline = deadlineFor(gameDate);
  const closesAt = deadline.toISOString();
  if (now.getTime() >= meterHiddenFrom(deadline).getTime()) {
    return { gameDate, status: "hidden", threshold: row.threshold, closesAt };
  }
  // With no weighted attempts yet the rate is unknown, not 0% and not NaN.
  const passRate = row.weightedAttempts > 0 ? row.weightedPasses / row.weightedAttempts : null;
  return { gameDate, status: "open", passRate, attempts: row.attempts, threshold: row.threshold, closesAt, streak: null };
}

type CountersRow = { attempts: number; weighted_attempts: number | string; weighted_passes: number | string };
type DayRow = {
  survival_threshold: number | string;
  // A one-to-one embed (the counters' key is the day's key) comes back as an object; accept a
  // one-element array too, so a change in how PostgREST detects that can never read as zero.
  game_day_counters: CountersRow | CountersRow[] | null;
};

/**
 * How long a CDN may keep `body`: METER_CACHE_SECONDS, but never past the moment the reading
 * goes out of date (the hidden window starting, or the deadline). The cache may also serve a
 * stale copy for as long again while it refreshes, so both periods must fit before that moment.
 */
export function meterCacheSeconds(body: MeterBody, now: Date): number {
  const outOfDateAt = body.status === "open" ? meterHiddenFrom(body.closesAt) : new Date(body.closesAt);
  const secondsLeft = Math.floor((outOfDateAt.getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(METER_CACHE_SECONDS, Math.floor(secondsLeft / 2)));
}

/**
 * Reads today's meter: the day's threshold and its running counters, in one query. It never
 * counts attempt rows (the counters are kept as attempts start and pass, T17). Pass the
 * service-role client: the counters are server-only, so that the hidden window means something.
 */
export async function readMeter(db: Pick<SupabaseClient, "from">, now: Date): Promise<MeterBody> {
  const gameDate = gameDateAt(now);
  const { data, error } = await db
    .from("game_days")
    .select("survival_threshold, game_day_counters(attempts, weighted_attempts, weighted_passes)")
    .eq("game_date", gameDate)
    .maybeSingle();
  if (error) throw new Error(`Meter lookup failed: ${error.message}`);

  const day = data as DayRow | null;
  const embedded = day?.game_day_counters ?? null;
  const counters = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;
  // No row yet means nobody has started; a row with a bad value is an error, not a zero.
  return meterBody(now, gameDate, {
    threshold: day ? dbNumber(day.survival_threshold, "survival_threshold") : null,
    attempts: counters ? dbInteger(counters.attempts, "attempts") : 0,
    weightedAttempts: counters ? dbNumber(counters.weighted_attempts, "weighted_attempts") : 0,
    weightedPasses: counters ? dbNumber(counters.weighted_passes, "weighted_passes") : 0,
  });
}
