import type { SupabaseClient } from "@supabase/supabase-js";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { addDays, gameDateAt } from "@/lib/gameDay";
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
  // The lineup's first game: what the home page and a signed-out /play name.
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

/**
 * Today's games in order (T160): the public lineup, or, before the first start creates it, the
 * one the lineup rule gives today (as `challenge_for` does for the first game).
 */
export async function todaysLineup(supabase: Db, now: Date): Promise<ChallengeType[]> {
  const gameDate = gameDateAt(now);
  const lineup = (types: unknown[]) => types.map((type) => knownType(gameDate, type));
  const { data, error } = await supabase
    .from("game_day_games")
    .select("challenge_type")
    .eq("game_date", gameDate)
    .order("position");
  if (error) throw new Error(`Game day lookup failed: ${error.message}`);
  if (data.length > 0) return lineup(data.map((game) => game.challenge_type));
  const previous = await supabase.rpc("lineup_of", { d: addDays(gameDate, -1) });
  if (previous.error) throw new Error(`Lineup lookup failed: ${previous.error.message}`);
  // Null when yesterday had no lineup; the rule then only avoids nothing.
  const rule = await supabase.rpc("lineup_for", { d: gameDate, previous: previous.data });
  if (rule.error) throw new Error(`Lineup lookup failed: ${rule.error.message}`);
  return lineup(rule.data ?? []);
}

/** One game of today's lineup as the player stands with it. */
export type GameStatus = LineupGame &
  ({ status: "not-started" | "in-progress" } | { status: "won" | "lost"; score: number });

/** What `/play` shows a signed-in player for today: the lineup in order, and their day. */
export type TodaysDay = DayResult & {
  gameDate: string;
  /** Empty while nobody has started today, so the day and its lineup do not exist yet. */
  games: GameStatus[];
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
  if (!day) return { ...result, gameDate, games: [], nextPosition: 1 };
  return {
    ...result,
    gameDate,
    games: day.games.map((game) => gameStatus(game, attempts.find((attempt) => attempt.position === game.position))),
    nextPosition: nextPosition(day, attempts),
  };
}
