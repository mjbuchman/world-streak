import type { SupabaseClient } from "@supabase/supabase-js";
import { METER_HIDE_HOURS } from "@/config/meter";
import { deadlineFor, gameDateAt } from "@/lib/gameDay";

const HOUR_MS = 60 * 60 * 1000;

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
 * pass rate or attempt count at all, so nothing can be read from it.
 */
export function meterBody(now: Date, gameDate: string, row: MeterRow): MeterBody {
  const deadline = deadlineFor(gameDate);
  const closesAt = deadline.toISOString();
  if (now.getTime() >= deadline.getTime() - METER_HIDE_HOURS * HOUR_MS) {
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
 * Reads today's meter: the day's threshold and its running counters, in one query. It never
 * counts attempt rows (the counters are kept as attempts start and pass, T17).
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
  // PostgREST returns numeric columns as JSON numbers or strings depending on size.
  return meterBody(now, gameDate, {
    threshold: day ? Number(day.survival_threshold) : null,
    attempts: counters?.attempts ?? 0,
    weightedAttempts: Number(counters?.weighted_attempts ?? 0),
    weightedPasses: Number(counters?.weighted_passes ?? 0),
  });
}
