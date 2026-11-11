import { innerClock } from "./inner-clock/engine";
import { CHALLENGE_TYPES, type ChallengeModule, type ChallengeType } from "./shared/types";
import { stacking } from "./stacking/engine";

/** Every challenge's engine, by type. The server builds and scores attempts through this. */
export const CHALLENGES = { stacking, "inner-clock": innerClock } satisfies Record<ChallengeType, unknown>;

/** Narrows a stored challenge type (plain text in the database) to one the server knows. */
export function isChallengeType(value: string): value is ChallengeType {
  return (CHALLENGE_TYPES as readonly string[]).includes(value);
}

/**
 * The engine for a game day's stored challenge type. An unknown type means the database and the
 * code disagree, so it throws (the endpoint answers 500) rather than guessing.
 */
export function challengeForGameDay(gameDate: string, challengeType: string): ChallengeModule<unknown, unknown> {
  if (!isChallengeType(challengeType)) throw new Error(`Game day ${gameDate} has unknown challenge type "${challengeType}"`);
  // With several engines the entry is a union TypeScript cannot call generically. Erasing the
  // params and inputs types is safe: callers only hand an engine its own paramsFromSeed result
  // and inputs its own inputsSchema parsed, never another engine's.
  return CHALLENGES[challengeType] as unknown as ChallengeModule<unknown, unknown>;
}
