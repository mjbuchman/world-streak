import type { SupabaseClient } from "@supabase/supabase-js";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { gameDateAt } from "@/lib/gameDay";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAttemptStore } from "./store";

type Db = Pick<SupabaseClient<Database>, "from" | "rpc">;

/** What the home page shows if today's challenge cannot be read at all (it logs the error). */
export const DEFAULT_CHALLENGE: ChallengeType = "stacking";

function knownType(gameDate: string, type: unknown): ChallengeType {
  if (typeof type !== "string" || !isChallengeType(type)) {
    throw new Error(`Game day ${gameDate} has unknown challenge type ${JSON.stringify(type)}`);
  }
  return type;
}

/**
 * Today's challenge: the public game day's, or, if nobody has created the day yet, the one the
 * rotation will give it (`challenge_for`, T31). It decides the page's title and how-to; the game
 * itself comes from the start reply.
 */
export async function todaysChallenge(supabase: Db, now: Date): Promise<ChallengeType> {
  const gameDate = gameDateAt(now);
  const { data, error } = await supabase.from("game_days").select("challenge_type").eq("game_date", gameDate).maybeSingle();
  if (error) throw new Error(`Game day lookup failed: ${error.message}`);
  if (data) return knownType(gameDate, data.challenge_type);
  const rotation = await supabase.rpc("challenge_for", { d: gameDate });
  if (rotation.error) throw new Error(`Rotation lookup failed: ${rotation.error.message}`);
  return knownType(gameDate, rotation.data);
}

/** What `/play` shows a signed-in player for today's game date. */
export type PlayStatus =
  | { kind: "ready" }
  | { kind: "submitted"; score: number; passed: boolean; passTarget: number }
  /**
   * Started but not submitted. It cannot be restarted. Runs have no time limit (T87), so it may
   * still be finished in another tab before the deadline; otherwise it counts as not passed.
   */
  | { kind: "abandoned" };

/**
 * The player's attempt for today's game date. Pass the server client: players may read their
 * own attempts under row-level security, and game days are public.
 */
export async function todaysAttempt(supabase: Db, userId: string, now: Date): Promise<PlayStatus> {
  const attempt = await supabaseAttemptStore(supabase).findAttemptForDay(userId, gameDateAt(now));
  if (!attempt) return { kind: "ready" };
  if (!attempt.submitted) return { kind: "abandoned" };
  return { kind: "submitted", score: attempt.score, passed: attempt.passed, passTarget: attempt.passTarget };
}
