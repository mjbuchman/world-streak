import type { SupabaseClient } from "@supabase/supabase-js";
import { gameDateAt } from "@/lib/gameDay";
import { supabaseAttemptStore } from "./store";

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
