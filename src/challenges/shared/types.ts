import type { z } from "zod";

/** Every challenge type, in the order they were added. */
export const CHALLENGE_TYPES = ["stacking", "inner-clock"] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** Whether a bigger score is better (for example height) or a smaller one (for example time). */
export type ScoreDirection = "higher-better" | "lower-better";

/**
 * A challenge engine: pure and deterministic, so the server can replay a player's inputs on
 * their seed and compute the official score. No randomness except `createRng(seed)`, no
 * clock, DOM or network (enforced by ESLint in `src/challenges/**`, except `render.ts`).
 *
 * Members are function properties rather than methods, so their parameters are type-checked
 * strictly.
 */
export interface ChallengeModule<Params, Inputs> {
  /** The player's instance of today's challenge, built only from the seed. */
  paramsFromSeed: (seed: number) => Params;
  /** The official score for these inputs on this instance. */
  score: (params: Params, inputs: Inputs) => number;
  /**
   * Whether these inputs end the run. The game submits only finished runs, so the server
   * refuses unfinished ones rather than scoring a run part-way.
   */
  finished: (params: Params, inputs: Inputs) => boolean;
  /** Validates inputs submitted by the client before they are scored. */
  inputsSchema: z.ZodType<Inputs>;
  direction: ScoreDirection;
  /**
   * Elapsed ms of the latest input, from the start of the run (0 with no inputs). The server
   * refuses inputs timed later than the attempt has actually been running.
   */
  lastInputMs: (inputs: Inputs) => number;
}
