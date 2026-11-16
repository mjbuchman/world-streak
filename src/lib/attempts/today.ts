import type { SupabaseClient } from "@supabase/supabase-js";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { gameDateAt } from "@/lib/gameDay";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseAttemptStore } from "./store";
import { nextPosition, type DayResult, type GameAttempt, type LineupGame } from "./types";

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
  // The lineup's first game, until /play runs all three (T156).
  const { data, error } = await supabase
    .from("game_day_games")
    .select("challenge_type")
    .eq("game_date", gameDate)
    .eq("position", 1)
    .maybeSingle();
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

/** One game of today's lineup as the player stands with it. */
export type GameStatus = LineupGame &
  ({ status: "not-started" | "in-progress" } | { status: "won" | "lost"; score: number });

/** What `/play` shows a signed-in player for today: the lineup in order, and their day. */
export type TodaysDay = {
  gameDate: string;
  /** Empty while nobody has started today, so the day and its lineup do not exist yet. */
  games: GameStatus[];
  outcome: DayResult["outcome"];
  /** The game a start would begin, or null once all of them have started. */
  nextPosition: number | null;
};

function gameStatus(game: LineupGame, attempt: GameAttempt | undefined): GameStatus {
  if (!attempt) return { ...game, status: "not-started" };
  // Runs have no time limit (T87), so a started game may still be finished in another tab.
  if (!attempt.submitted) return { ...game, status: "in-progress" };
  return { ...game, status: attempt.passed ? "won" : "lost", score: attempt.score };
}

/**
 * Today's lineup and the player's progress through it. Pass the server client: players may read
 * their own attempts and day results under row-level security, and lineups are public.
 */
export async function todaysDay(supabase: Db, userId: string, now: Date): Promise<TodaysDay> {
  const gameDate = gameDateAt(now);
  const store = supabaseAttemptStore(supabase);
  const [day, attempts, result] = await Promise.all([
    store.gameDay(gameDate),
    store.dayAttempts(userId, gameDate),
    store.dayResult(userId, gameDate),
  ]);
  if (!day) return { gameDate, games: [], outcome: null, nextPosition: 1 };
  return {
    gameDate,
    games: day.games.map((game) => gameStatus(game, attempts.find((attempt) => attempt.position === game.position))),
    outcome: result.outcome,
    nextPosition: nextPosition(day, attempts),
  };
}

/** Today's first game for the one-game `/play`, until it runs all three (T156). */
export async function todaysAttempt(supabase: Db, userId: string, now: Date): Promise<PlayStatus> {
  const first = (await todaysDay(supabase, userId, now)).games[0];
  if (first?.status === "won" || first?.status === "lost") {
    return { kind: "submitted", score: first.score, passed: first.status === "won", passTarget: first.passTarget };
  }
  return first?.status === "in-progress" ? { kind: "abandoned" } : { kind: "ready" };
}
