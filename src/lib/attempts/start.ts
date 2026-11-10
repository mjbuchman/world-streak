import { challengeForGameDay } from "@/challenges/registry";
import { gameDateAt } from "@/lib/gameDay";
import type { DayAttempt, GameDay } from "./types";

/** The database operations starting an attempt needs (see `supabaseAttemptStore`). */
export type AttemptStore = {
  hasProfile: (userId: string) => Promise<boolean>;
  /** Creates the game day with the launch defaults if it does not exist yet. */
  ensureGameDay: (gameDate: string) => Promise<void>;
  /** The day's challenge, target and state (a game day exists once ensureGameDay has run). */
  gameDay: (gameDate: string) => Promise<GameDay>;
  findAttemptForDay: (userId: string, gameDate: string) => Promise<DayAttempt | null>;
  /** "duplicate" when the player already has an attempt that day (the unique constraint). */
  insertAttempt: (attempt: { userId: string; gameDate: string; seed: number }) => Promise<{ id: string } | "duplicate">;
};

export type StartResult =
  | {
      status: 200;
      body: { attemptId: string; gameDate: string; challengeType: string; seed: number; params: unknown; passTarget: number };
    }
  | { status: 403; body: { error: "profile-required" } }
  | { status: 409; body: { error: "already-started"; submitted: boolean } };

type StartInput = {
  userId: string;
  now: Date;
  store: AttemptStore;
  /** An unsigned 32-bit integer from a secure source; the server, never the client, picks it. */
  randomSeed: () => number;
};

const alreadyStarted = (submitted: boolean): StartResult => ({
  status: 409,
  body: { error: "already-started", submitted },
});

/**
 * Starts today's scored attempt for a signed-in player. Each player gets one attempt per game
 * day and it cannot be restarted: a restart would replay the same seed, so the player would
 * already know the instance. Database errors are thrown, for the endpoint to answer 500.
 */
export async function startAttempt({ userId, now, store, randomSeed }: StartInput): Promise<StartResult> {
  if (!(await store.hasProfile(userId))) return { status: 403, body: { error: "profile-required" } };

  const gameDate = gameDateAt(now);
  await store.ensureGameDay(gameDate);
  const { challengeType, passTarget } = await store.gameDay(gameDate);
  const challenge = challengeForGameDay(gameDate, challengeType);

  const existing = await store.findAttemptForDay(userId, gameDate);
  if (existing) return alreadyStarted(existing.submitted);

  const seed = randomSeed();
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error(`Not an unsigned 32-bit seed: ${seed}`);

  const inserted = await store.insertAttempt({ userId, gameDate, seed });
  if (inserted === "duplicate") {
    // A simultaneous request won the race; report what it created.
    return alreadyStarted((await store.findAttemptForDay(userId, gameDate))?.submitted ?? false);
  }
  return {
    status: 200,
    body: {
      attemptId: inserted.id,
      gameDate,
      challengeType,
      seed,
      params: challenge.paramsFromSeed(seed),
      // Shown during the run (the target line); the server still decides pass or fail on submit.
      passTarget,
    },
  };
}
