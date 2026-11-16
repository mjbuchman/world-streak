import { challengeForGameDay } from "@/challenges/registry";
import { gameDateAt } from "@/lib/gameDay";
import { nextPosition, type GameAttempt, type GameDay } from "./types";

/** The database operations starting an attempt needs (see `supabaseAttemptStore`). */
export type AttemptStore = {
  hasProfile: (userId: string) => Promise<boolean>;
  /** Creates the game day and its lineup with the launch defaults if it does not exist yet. */
  ensureGameDay: (gameDate: string) => Promise<void>;
  /** The day's lineup and state, or null before the day exists (ensureGameDay creates it). */
  gameDay: (gameDate: string) => Promise<GameDay | null>;
  /** The player's attempts that day, in lineup order. */
  dayAttempts: (userId: string, gameDate: string) => Promise<GameAttempt[]>;
  /**
   * "duplicate" when the player already started that game (a unique constraint);
   * "day-closed" when the day was closed by the time the insert ran (the close job won the race).
   */
  insertAttempt: (attempt: {
    userId: string;
    gameDate: string;
    position: number;
    seed: number;
  }) => Promise<{ id: string } | "duplicate" | "day-closed">;
};

export type Started = {
  attemptId: string;
  gameDate: string;
  position: number;
  challengeType: string;
  seed: number;
  params: unknown;
  passTarget: number;
};

export type StartResult =
  | { status: 200; body: Started }
  | { status: 403; body: { error: "profile-required" } }
  | { status: 409; body: { error: "already-started" | "day-complete" | "day-closed" } };

type StartInput = {
  userId: string;
  now: Date;
  store: AttemptStore;
  /** An unsigned 32-bit integer from a secure source; the server, never the client, picks it. */
  randomSeed: () => number;
};

/** Reads a lineup the start or submit flow needs; the day always exists after ensureGameDay. */
export async function requireGameDay(store: Pick<AttemptStore, "gameDay">, gameDate: string): Promise<GameDay> {
  const day = await store.gameDay(gameDate);
  if (!day) throw new Error(`Game day ${gameDate} does not exist`);
  return day;
}

/**
 * Starts the player's next game of today's lineup, in the day's order. A game cannot be
 * restarted: a restart would replay the same seed, so the player would already know the
 * instance. A started game that was never submitted stays a loss, and the next start moves on
 * to the next game. Database errors are thrown, for the endpoint to answer 500.
 */
export async function startAttempt({ userId, now, store, randomSeed }: StartInput): Promise<StartResult> {
  if (!(await store.hasProfile(userId))) return { status: 403, body: { error: "profile-required" } };

  const gameDate = gameDateAt(now);
  await store.ensureGameDay(gameDate);
  const day = await requireGameDay(store, gameDate);
  // A decided day still lets the player play its remaining game.
  const position = nextPosition(day, await store.dayAttempts(userId, gameDate));
  if (position === null) return { status: 409, body: { error: "day-complete" } };
  const game = day.games[position - 1];
  const challenge = challengeForGameDay(gameDate, game.challengeType);

  const seed = randomSeed();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`Not an unsigned 32-bit seed: ${seed}`);

  const inserted = await store.insertAttempt({ userId, gameDate, position, seed });
  // A simultaneous request started this game first; its reply has the game.
  if (inserted === "duplicate") return { status: 409, body: { error: "already-started" } };
  // The deadline passed between working out the game date and the insert; nothing was stored.
  if (inserted === "day-closed") return { status: 409, body: { error: "day-closed" } };
  return {
    status: 200,
    body: {
      attemptId: inserted.id,
      gameDate,
      position,
      challengeType: game.challengeType,
      seed,
      params: challenge.paramsFromSeed(seed),
      // Shown during the run (the target line); the server still decides pass or fail on submit.
      passTarget: game.passTarget,
    },
  };
}
