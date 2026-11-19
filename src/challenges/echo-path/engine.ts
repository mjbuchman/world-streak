import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { COLS, MAX_PATH_LENGTH, pathFor, ROWS } from "./path";

/**
 * Trail Trace (T188, T208): one seeded path of 8 to 12 tiles climbs the 5 x 8 board from the bottom row to the top (T207).
 * Each round plays back the path's first tiles and the player taps them back in order; a cleared
 * round adds the path's next tile. A wrong tile costs one of LIVES lives and the same tiles play
 * again. The run ends when the whole path is cleared or the lives run out. There is no time
 * limit per tap, as the Tower has none (DECISIONS, T143). Score = longest length cleared + lives
 * left as a fraction. The start of 4 and the lives (the first try plus one extra life, M8 T219)
 * are the owner's; the step speeds are proposed.
 */

export { COLS, ROWS };
export const START_LENGTH = 4;
export const LIVES = 2;
/** How long each tile of a playback lights, in a multiple of 50 ms from this range (inclusive). */
export const STEP_MS_RANGE = { min: 300, max: 400 } as const;
const STEP_UNIT_MS = 50;

/** The most taps a run can take: every length of the longest path cleared, and a full miss at the last for each spare life. */
export const MAX_TAPS = ((START_LENGTH + MAX_PATH_LENGTH) * (MAX_PATH_LENGTH - START_LENGTH + 1)) / 2 + (LIVES - 1) * MAX_PATH_LENGTH;

export type EchoPathParams = { cols: number; rows: number; path: number[]; startLength: number; stepMs: number };

/** Every tap in order, retries included: the tile (row by row from the bottom) and when, from the run start. */
export type EchoPathInputs = { taps: { tile: number; atMs: number }[] };

export function paramsFromSeed(seed: number): EchoPathParams {
  const rng = createRng(seed);
  const stepMs = rng.int(STEP_MS_RANGE.min / STEP_UNIT_MS, STEP_MS_RANGE.max / STEP_UNIT_MS) * STEP_UNIT_MS;
  return { cols: COLS, rows: ROWS, path: pathFor(rng.int(0, 0xffff_ffff)), startLength: START_LENGTH, stepMs };
}

/** The tiles a round of this length plays: the path's first `length`, the same on every try. */
export const sequenceFor = (params: EchoPathParams, length: number): number[] => params.path.slice(0, length);

/** Plays the taps: the length being repeated, how far into it, lives, the longest cleared, and whether the run is over. */
export function play(params: EchoPathParams, inputs: EchoPathInputs) {
  let length = params.startLength;
  let position = 0;
  let lives = LIVES;
  let longest = 0;
  const over = () => lives === 0 || longest === params.path.length;
  for (const { tile } of inputs.taps) {
    if (over()) break;
    if (tile === params.path[position]) {
      position++;
      if (position < length) continue;
      longest = length;
      length++;
    } else {
      lives--;
    }
    position = 0;
  }
  return { length, position, lives, longest, finished: over() };
}

const inputsSchema: z.ZodType<EchoPathInputs> = z.object({
  taps: z
    .array(z.object({ tile: z.number().int().min(0).max(COLS * ROWS - 1), atMs: z.number().nonnegative() }))
    .max(MAX_TAPS)
    .refine((taps) => taps.every((tap, i) => i === 0 || tap.atMs > taps[i - 1].atMs), "tap times must rise"),
});

export const echoPath: ChallengeModule<EchoPathParams, EchoPathInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { longest, lives } = play(params, inputs);
    return Math.round((longest + lives / LIVES) * 1000) / 1000;
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  lastInputMs: ({ taps }) => taps.at(-1)?.atMs ?? 0,
};
