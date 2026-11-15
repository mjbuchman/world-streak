import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";

/**
 * Echo Path: tiles on a grid light up in a sequence and the player repeats it. A cleared sequence
 * adds one step; a wrong tile costs one of LIVES lives and the next try is a new sequence of the
 * same length. Each length's sequence is drawn on its own (not grown from the last). There is no
 * time limit per tap, as the Tower has none (DECISIONS, T143). Score = longest length cleared +
 * lives left as a fraction, when the run ends. All numbers below are placeholders tuned at the M5
 * play-test.
 */

export const COLS = 3;
export const ROWS = 3;
export const START_LENGTH = 3;
export const MAX_LENGTH = 12;
export const LIVES = 3;
/** How long each tile of a sequence lights, in a multiple of 50 ms from this range (inclusive). */
export const STEP_MS_RANGE = { min: 450, max: 650 } as const;
const STEP_UNIT_MS = 50;

/** The most taps a run can take: every length cleared, and two full sequences missed on the last tile. */
export const MAX_TAPS = ((START_LENGTH + MAX_LENGTH) * (MAX_LENGTH - START_LENGTH + 1)) / 2 + (LIVES - 1) * MAX_LENGTH;

export type EchoPathParams = { cols: number; rows: number; startLength: number; maxLength: number; stepMs: number; sequenceSeed: number };

/** Every tap in order, retries included: the tile (row by row from 0) and when, from the run start. */
export type EchoPathInputs = { taps: { tile: number; atMs: number }[] };

export function paramsFromSeed(seed: number): EchoPathParams {
  const rng = createRng(seed);
  const stepMs = rng.int(STEP_MS_RANGE.min / STEP_UNIT_MS, STEP_MS_RANGE.max / STEP_UNIT_MS) * STEP_UNIT_MS;
  return { cols: COLS, rows: ROWS, startLength: START_LENGTH, maxLength: MAX_LENGTH, stepMs, sequenceSeed: rng.int(0, 0xffff_ffff) };
}

/** The tiles for a length's `tryIndex`-th try (0 first): the same every time, new for each retry, never one tile twice in a row. */
export function sequenceFor(params: EchoPathParams, length: number, tryIndex: number): number[] {
  // Mixes the three numbers into one 32-bit seed, so neighbouring lengths and tries differ.
  const rng = createRng((params.sequenceSeed ^ Math.imul(length, 0x9e37_79b1) ^ Math.imul(tryIndex + 1, 0x85eb_ca6b)) >>> 0);
  const tiles = params.cols * params.rows;
  const sequence: number[] = [];
  while (sequence.length < length) {
    // Any tile but the last one: draw from one fewer and skip over it.
    const last = sequence.at(-1);
    const drawn = rng.int(0, last === undefined ? tiles - 1 : tiles - 2);
    sequence.push(last !== undefined && drawn >= last ? drawn + 1 : drawn);
  }
  return sequence;
}

/** Plays the taps: the length being repeated, how far into it, lives, which try it is, the longest cleared, and whether the run is over. */
export function play(params: EchoPathParams, inputs: EchoPathInputs) {
  let length = params.startLength;
  let position = 0;
  let lives = LIVES;
  let tryIndex = 0;
  let longest = 0;
  const over = () => lives === 0 || longest === params.maxLength;
  let sequence = sequenceFor(params, length, tryIndex);
  for (const { tile } of inputs.taps) {
    if (over()) break;
    if (tile === sequence[position]) {
      position++;
      if (position < length) continue;
      longest = length;
      length++;
      tryIndex = 0;
    } else {
      lives--;
      tryIndex++;
    }
    position = 0;
    if (!over()) sequence = sequenceFor(params, length, tryIndex);
  }
  return { length, position, lives, tryIndex, longest, finished: over() };
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
