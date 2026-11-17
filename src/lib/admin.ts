// The admin page's data. Server components only: the parsers (zod) must not ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeType } from "@/challenges/shared/types";
import { dbNumber } from "@/lib/db/numeric";
import { addDays, gameDateAt } from "@/lib/gameDay";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/** The admin page shows today and this many days after it. */
export const ADMIN_DAYS_AHEAD = 7;

/** One game of a day's lineup; `started`: it has an attempt, so its pass target is locked (T161). */
export type AdminGame = {
  position: number;
  challengeType: ChallengeType;
  passTarget: number;
  started: boolean;
};

/** `started`: somebody has started the day, so its games are locked (T111, T161). */
export type AdminDay = {
  gameDate: string;
  games: AdminGame[];
  threshold: number;
  closed: boolean;
  started: boolean;
};

const lineupSchema = z.array(z.object({ position: z.number(), challenge_type: z.enum(CHALLENGE_TYPES), pass_target: z.unknown() }));

/**
 * Whether the signed-in caller is an admin, from the database's own `is_admin()` (which reads
 * their profile). Pass the cookie client, never the service role: the answer is about the caller.
 */
export async function isAdmin(db: Pick<Db, "rpc">): Promise<boolean> {
  const { data, error } = await db.rpc("is_admin");
  if (error) throw new Error(`Admin check failed: ${error.message}`);
  return data === true;
}

/**
 * Today and the next ADMIN_DAYS_AHEAD game days, creating any that do not exist yet the way
 * the close job would. Pass the service-role client (ensure_game_day is server only), and only
 * after isAdmin has said yes.
 */
export async function readAdminDays(db: Pick<Db, "from" | "rpc">, now: Date): Promise<AdminDay[]> {
  const today = gameDateAt(now);
  const dates = Array.from({ length: ADMIN_DAYS_AHEAD + 1 }, (_, i) => addDays(today, i));
  const ensured = await Promise.all(dates.map((d) => db.rpc("ensure_game_day", { d })));
  const failed = ensured.find((reply) => reply.error);
  if (failed?.error) throw new Error(`Preparing game days failed: ${failed.error.message}`);

  const last = dates[dates.length - 1];
  const [{ data, error }, starts] = await Promise.all([
    db
      .from("game_days")
      .select("game_date, survival_threshold, closed_at, game_day_games(position, challenge_type, pass_target)")
      .gte("game_date", today)
      .lte("game_date", last)
      .order("game_date", { ascending: true }),
    // Only drives the display; the database's triggers decide the locks.
    db.rpc("started_games", { first_day: today, last_day: last }),
  ]);
  if (error) throw new Error(`Game day lookup failed: ${error.message}`);
  if (starts.error) throw new Error(`Start lookup failed: ${starts.error.message}`);
  const started = new Set(starts.data.map((row) => `${row.game_date}#${row.game_position}`));

  return data.map((row) => {
    const games = lineupSchema
      .parse(row.game_day_games)
      .sort((a, b) => a.position - b.position)
      .map((game) => ({
        position: game.position,
        challengeType: game.challenge_type,
        passTarget: dbNumber(game.pass_target, "pass_target"),
        started: started.has(`${row.game_date}#${game.position}`),
      }));
    return {
      gameDate: row.game_date,
      games,
      threshold: dbNumber(row.survival_threshold, "survival_threshold"),
      closed: row.closed_at !== null,
      started: games.some((game) => game.started),
    };
  });
}
