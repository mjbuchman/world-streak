import { CHALLENGE_TYPES, type ChallengeType } from "./shared/types";
import { stacking } from "./stacking/engine";

/** Every challenge's engine, by type. The server builds and scores attempts through this. */
export const CHALLENGES = { stacking } satisfies Record<ChallengeType, unknown>;

/** Narrows a stored challenge type (plain text in the database) to one the server knows. */
export function isChallengeType(value: string): value is ChallengeType {
  return (CHALLENGE_TYPES as readonly string[]).includes(value);
}
