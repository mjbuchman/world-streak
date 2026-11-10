import type { SupabaseClient } from "@supabase/supabase-js";
import { gameDateAt } from "@/lib/gameDay";

/** What `/play` shows a signed-in player for today's game date. */
export type PlayStatus =
  | { kind: "ready" }
  | { kind: "submitted"; score: number; passed: boolean; passTarget: number }
  /** Started but never submitted: it counts as not passed, and it cannot be restarted. */
  | { kind: "abandoned" };

type Row = {
  score: number | string | null;
  passed: boolean | null;
  submitted_at: string | null;
  game_days: { pass_target: number | string };
};

/**
 * The player's attempt for today's game date. Pass the server client: players may read their
 * own attempts under row-level security, and game days are public.
 */
export async function todaysAttempt(supabase: Pick<SupabaseClient, "from">, userId: string, now: Date): Promise<PlayStatus> {
  const { data, error } = await supabase
    .from("attempts")
    .select("score, passed, submitted_at, game_days(pass_target)")
    .eq("user_id", userId)
    .eq("game_date", gameDateAt(now))
    .maybeSingle();
  if (error) throw new Error(`Today's attempt lookup failed: ${error.message}`);
  if (!data) return { kind: "ready" };

  const row = data as unknown as Row;
  if (row.submitted_at === null) return { kind: "abandoned" };
  return {
    kind: "submitted",
    score: Number(row.score),
    passed: row.passed === true,
    passTarget: Number(row.game_days.pass_target),
  };
}
