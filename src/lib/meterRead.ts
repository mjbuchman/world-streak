// Server side of the meter: the one query and its strict parsing. Kept apart from
// src/lib/meter.ts, which the browser loads, so the parser (zod) stays out of the client bundle.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { gameDateAt } from "@/lib/gameDay";
import { meterBody, type MeterBody } from "@/lib/meter";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Reads today's meter: the day's threshold and its running counters in one query, and the world
 * streak (T21) alongside it. It never counts attempt rows (the counters are kept as attempts
 * start and pass, T17). Pass the service-role client: the counters are server-only, so that the
 * hidden window means something.
 */
export async function readMeter(db: Pick<SupabaseClient<Database>, "from" | "rpc">, now: Date): Promise<MeterBody> {
  const gameDate = gameDateAt(now);
  const [dayReply, streakReply] = await Promise.all([
    db
      .from("game_days")
      .select("survival_threshold, game_day_counters(attempts, weighted_attempts, weighted_passes)")
      .eq("game_date", gameDate)
      .maybeSingle(),
    db.rpc("world_streak").single(),
  ]);
  if (dayReply.error) throw new Error(`Meter lookup failed: ${dayReply.error.message}`);
  if (streakReply.error) throw new Error(`World streak lookup failed: ${streakReply.error.message}`);

  const day = dayReply.data;
  // world_streak() always returns exactly one row (zeros when there is no run), and .single()
  // turns anything else into the error above, so the row is present here.
  const streak = streakReply.data;
  // A one-to-one embed (the counters' key is the day's key) comes back as an object; accept a
  // one-element array too, so a change in how PostgREST detects that can never read as zero.
  // The generated embed type cannot say "object or array", hence the cast below.
  const embedded: unknown = day?.game_day_counters ?? null;
  const counters = (Array.isArray(embedded) ? (embedded[0] ?? null) : embedded) as Record<
    "attempts" | "weighted_attempts" | "weighted_passes",
    unknown
  > | null;
  // No row yet means nobody has started; a row with a bad value is an error, not a zero.
  return meterBody(now, gameDate, {
    threshold: day ? dbNumber(day.survival_threshold, "survival_threshold") : null,
    attempts: counters ? dbInteger(counters.attempts, "attempts") : 0,
    weightedAttempts: counters ? dbNumber(counters.weighted_attempts, "weighted_attempts") : 0,
    weightedPasses: counters ? dbNumber(counters.weighted_passes, "weighted_passes") : 0,
    streak: { current: dbInteger(streak.current, "current"), best: dbInteger(streak.best, "best") },
  });
}
