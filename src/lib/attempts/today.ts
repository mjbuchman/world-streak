import type { SupabaseClient } from "@supabase/supabase-js";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { gameDateAt } from "@/lib/gameDay";
import { supabaseAttemptStore } from "./store";

/**
 * The challenge a day gets when the first start creates it (`ensure_game_day`, which the close
 * job also runs for the next day). Until the rotation (T31) every day is the Tower.
 */
export const DEFAULT_CHALLENGE: ChallengeType = "stacking";

/**
 * Today's challenge, read from the public game day (DEFAULT_CHALLENGE if nobody has created the
 * day yet). It decides the page's title and how-to; the game itself comes from the start reply.
 */
export async function todaysChallenge(supabase: Pick<SupabaseClient, "from">, now: Date): Promise<ChallengeType> {
  const gameDate = gameDateAt(now);
  const { data, error } = await supabase.from("game_days").select("challenge_type").eq("game_date", gameDate).maybeSingle();
  if (error) throw new Error(`Game day lookup failed: ${error.message}`);
  if (!data) return DEFAULT_CHALLENGE;
  const type = (data as { challenge_type: string }).challenge_type;
  if (!isChallengeType(type)) throw new Error(`Game day ${gameDate} has unknown challenge type "${type}"`);
  return type;
}

/** What `/play` shows a signed-in player for today's game date. */
export type PlayStatus =
  | { kind: "ready" }
  | { kind: "submitted"; score: number; passed: boolean; passTarget: number }
  /** Started but never submitted: it counts as not passed, and it cannot be restarted. */
  | { kind: "abandoned" };

/**
 * The player's attempt for today's game date. Pass the server client: players may read their
 * own attempts under row-level security, and game days are public.
 */
export async function todaysAttempt(supabase: Pick<SupabaseClient, "from" | "rpc">, userId: string, now: Date): Promise<PlayStatus> {
  const attempt = await supabaseAttemptStore(supabase).findAttemptForDay(userId, gameDateAt(now));
  if (!attempt) return { kind: "ready" };
  if (!attempt.submitted) return { kind: "abandoned" };
  return { kind: "submitted", score: attempt.score, passed: attempt.passed, passTarget: attempt.passTarget };
}
