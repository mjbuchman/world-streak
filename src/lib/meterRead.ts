// Server side of the meter: the one query and its strict parsing. Kept apart from
// src/lib/meter.ts, which the browser loads, so the parser (zod) stays out of the client bundle.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { gameDateAt } from "@/lib/gameDay";
import { meterBody, type MeterBody } from "@/lib/meter";

type CountersRow = { attempts: number; weighted_attempts: number | string; weighted_passes: number | string };
type DayRow = {
  survival_threshold: number | string;
  // A one-to-one embed (the counters' key is the day's key) comes back as an object; accept a
  // one-element array too, so a change in how PostgREST detects that can never read as zero.
  game_day_counters: CountersRow | CountersRow[] | null;
};

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
