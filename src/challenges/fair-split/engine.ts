import { z } from "zod";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { BOX, shapeFor, splitShare, type Point } from "./geometry";

/**
 * Fair Split: a shape appears and the player drags one straight cut across it. The cut counts when
 * both sides are within TOLERANCE_POINTS of 50% of the area; a cut outside that (a line missing
 * the shape included), or no cut by the shape's time limit, costs one of LIVES lives and the same
 * shape comes back. Each shape appears GAP_MS after the last one ended. Score = shapes cut + lives
 * left as a fraction, when the run ends. All numbers below are placeholders tuned at the M5
 * play-test (DECISIONS, T147).
 */

export const LIVES = 3;
export const TOLERANCE_POINTS = 1;
export const MAX_SHAPES = 12;
/** The pause between one shape ending (cut or timed out) and the next appearing. */
export const GAP_MS = 1200;
/** The first shape's time limit, how much each later shape loses, and the floor. */
export const LIMIT_MS = { first: 7000, step: 300, min: 4000 } as const;
/** The most cuts a run can take: every shape cut, plus a miss for all but the last life. */
export const MAX_CUTS = MAX_SHAPES + LIVES - 1;
/** Rounding slack, so a cut exactly at 49/51 counts. */
const EPSILON = 1e-9;

export type FairSplitShape = { polygon: Point[]; limitMs: number };
export type FairSplitParams = { shapes: FairSplitShape[] };

/** A cut is the line through (ax, ay) and (bx, by), in shape units, `atMs` from the run start. */
export type FairSplitCut = { atMs: number; ax: number; ay: number; bx: number; by: number };
/** Every cut in order, and when the run ended (a timeout is judged against it). */
export type FairSplitInputs = { cuts: FairSplitCut[]; endMs: number };

/** Shape k's time limit. */
export const limitFor = (k: number) => Math.max(LIMIT_MS.min, LIMIT_MS.first - k * LIMIT_MS.step);
/** Shapes 0 and 1 are convex; oddness then rises to 1 by shape 7. */
export const oddnessFor = (k: number) => Math.min(1, Math.max(0, (k - 1) / 6));

export function paramsFromSeed(seed: number): FairSplitParams {
  const shapeSeed = createRng(seed).int(0, 0xffff_ffff);
  return { shapes: Array.from({ length: MAX_SHAPES }, (_, k) => ({ polygon: shapeFor(shapeSeed, k, oddnessFor(k)), limitMs: limitFor(k) })) };
}

/** How a shape's turn ended: a cut (with the share on its left, and whether it counted) or a timeout. */
export type FairSplitOutcome =
  | { kind: "cut"; shape: number; atMs: number; share: number; counted: boolean; cut: FairSplitCut }
  | { kind: "timeout"; shape: number; atMs: number };

/** Whether a share (0 to 1) is close enough to half. */
export const isFair = (share: number) => Math.abs(share * 100 - 50) <= TOLERANCE_POINTS + EPSILON;

/**
 * Plays the cuts up to `endMs`: the shape on screen, when it appeared and its deadline, the lives,
 * the last turn's outcome and whether the run is over. Cuts during the pause before a shape are
 * ignored; a cut after the deadline is judged against the next shape, the timed-out one having
 * already cost a life.
 */
export function play(params: FairSplitParams, { cuts, endMs }: FairSplitInputs) {
  let shape = 0;
  let lives = LIVES;
  let appearsAt = 0;
  let last: FairSplitOutcome | null = null;
  const over = () => lives === 0 || shape === params.shapes.length;
  const deadline = () => appearsAt + params.shapes[shape].limitMs;
  const end = (outcome: FairSplitOutcome, counted: boolean) => {
    last = outcome;
    if (counted) shape++;
    else lives--;
    appearsAt = outcome.atMs + GAP_MS;
  };
  const timeOutBefore = (ms: number) => {
    while (!over() && ms > deadline()) end({ kind: "timeout", shape, atMs: deadline() }, false);
  };
  for (const cut of cuts) {
    timeOutBefore(cut.atMs);
    if (over()) break;
    if (cut.atMs < appearsAt) continue;
    const share = splitShare(params.shapes[shape].polygon, { x: cut.ax, y: cut.ay }, { x: cut.bx, y: cut.by });
    const counted = isFair(share);
    end({ kind: "cut", shape, atMs: cut.atMs, share, counted, cut }, counted);
  }
  timeOutBefore(endMs);
  const finished = over();
  return { shape, lives, appearsAt, deadline: finished ? null : deadline(), last: last as FairSplitOutcome | null, finished };
}

const coordinate = z.number().min(0).max(BOX);
const inputsSchema: z.ZodType<FairSplitInputs> = z
  .object({
    cuts: z
      .array(z.object({ atMs: z.number().nonnegative(), ax: coordinate, ay: coordinate, bx: coordinate, by: coordinate }))
      .max(MAX_CUTS)
      .refine((cuts) => cuts.every((cut, i) => i === 0 || cut.atMs > cuts[i - 1].atMs), "cut times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ cuts, endMs }) => endMs >= (cuts.at(-1)?.atMs ?? 0), "the run cannot end before its last cut");

export const fairSplit: ChallengeModule<FairSplitParams, FairSplitInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { shape, lives } = play(params, inputs);
    return Math.round((shape + lives / LIVES) * 1000) / 1000;
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  lastInputMs: ({ endMs }) => endMs,
};
