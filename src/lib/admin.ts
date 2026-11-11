// The admin page's data. Server components only: the parsers (zod) must not ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbNumber } from "@/lib/db/numeric";
import { addDays, gameDateAt } from "@/lib/gameDay";

/** The admin page shows today and this many days after it. */
export const ADMIN_DAYS_AHEAD = 7;

/** `started`: somebody has started the day, so its pass target is locked (T102). */
export type AdminDay = {
  gameDate: string;
  challengeType: string;
  passTarget: number;
  threshold: number;
  closed: boolean;
  started: boolean;
};

/**
 * Whether the signed-in caller is an admin, from the database's own `is_admin()` (which reads
 * their profile). Pass the cookie client, never the service role: the answer is about the caller.
 */
export async function isAdmin(db: Pick<SupabaseClient, "rpc">): Promise<boolean> {
  const { data, error } = await db.rpc("is_admin");
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  return data === true;
}

/**
 * Today and the next ADMIN_DAYS_AHEAD game days, creating any that do not exist yet the way
 * the close job would. Pass the service-role client (ensure_game_day is server only), and only
 * after isAdmin has said yes.
 */
export async function readAdminDays(db: Pick<SupabaseClient, "from" | "rpc">, now: Date): Promise<AdminDay[]> {
  const today = gameDateAt(now);
  const dates = Array.from({ length: ADMIN_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
  const ensured = await Promise.all(dates.map((d) => db.rpc("ensure_game_day", { d })));
  const failed = ensured.find((reply) => reply.error);
  if (failed?.error) throw new Error(`Preparing game days failed: ${failed.error.message}`);

  const last = dates[dates.length - 1];
  const [{ data, error }, starts] = await Promise.all([
    db
      .from("game_days")
      .select("game_date, challenge_type, pass_target, survival_threshold, closed_at")
      .gte("game_date", today)
      .lte("game_date", last)
      .order("game_date", { ascending: true }),
    // The counters, not the attempts themselves: one row per day rather than one per player. This
    // only drives the display; the database's trigger on the attempts decides the lock.
    db.from("game_day_counters").select("game_date").gt("attempts", 0).gte("game_date", today).lte("game_date", last),
  ]);
  if (error) throw new Error(`Game day lookup failed: ${error.message}`);
  if (starts.error) throw new Error(`Start count lookup failed: ${starts.error.message}`);
  const started = new Set((starts.data as { game_date: string }[]).map((row) => row.game_date));

  const rows = data as { game_date: string; challenge_type: string; pass_target: unknown; survival_threshold: unknown; closed_at: string | null }[];
  return rows.map((row) => ({
    gameDate: row.game_date,
    challengeType: row.challenge_type,
    passTarget: dbNumber(row.pass_target, "pass_target"),
    threshold: dbNumber(row.survival_threshold, "survival_threshold"),
    closed: row.closed_at !== null,
    started: started.has(row.game_date),
  }));
}
