import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank } from "../shared/bank";
import { createRng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { BOX, splitShare, type Point } from "./geometry";
import { shapeFor } from "./shapes";

/**
 * Fair Split (T193): five shapes, one straight cut each, against a bank of points. A cut costs its
 * distance from 50% of the area, in points; a cut that does not fit what is left of the bank ends
 * the run. A cut after the shape's time limit, or none by then, costs the furthest a cut can be
 * from half, which no bank survives. Score = shapes survived + bank left as a fraction (T180).
 *
 * Time runs from the start of the game, which opens with a 3-2-1; every shape follows its own 3-2-1,
 * and the cut pieces stay on screen for SHOW_MS before the next one. Bank, limit and SHOW_MS are
 * proposed, owner to confirm (DECISIONS, T193).
 */

export const ROUNDS = 5;
/** The bank, in percentage points (about 1.6 a shape; T211, the owner's 8). */
export const BANK_POINTS = 8;
/** Each shape's time limit. The screen cuts the current line when it runs out. */
export const LIMIT_MS = 25_000;
/** How long the two pieces and their shares stay on screen after a cut. */
export const SHOW_MS = 1200;
/** The 3-2-1 before every shape. */
export const ROUND_COUNTDOWN_MS = RUN_COUNTDOWN_MS;
/** From one shape's cut to the next shape appearing: the pieces, then the 3-2-1. */
export const GAP_MS = SHOW_MS + ROUND_COUNTDOWN_MS;
/** What a late cut, or no cut, costs: the most a cut can be off. */
export const MISSED_COST = 50;

export type FairSplitShape = { polygon: Point[]; limitMs: number };
export type FairSplitParams = { bank: number; shapes: FairSplitShape[] };

/** A cut is the line through (ax, ay) and (bx, by), in shape units, `atMs` from the game's start. */
export type FairSplitCut = { atMs: number; ax: number; ay: number; bx: number; by: number };
/** Every cut in order, and when the run ended (a missed limit is judged against it). */
export type FairSplitInputs = { cuts: FairSplitCut[]; endMs: number };

export function paramsFromSeed(seed: number): FairSplitParams {
  const shapeSeed = createRng(seed).int(0, 0xffff_ffff);
  return { bank: BANK_POINTS, shapes: Array.from({ length: ROUNDS }, (_, k) => ({ polygon: shapeFor(shapeSeed, k), limitMs: LIMIT_MS })) };
}

/** A cut's distance from half, in points, to 0.01 (a 49/51 split costs 1). */
export const cutCost = (share: number) => Math.round(Math.abs(share * 100 - 50) * 100) / 100;

/** How a shape's turn ended: a cut (its share on the left and its cost) or a missed limit. */
export type FairSplitOutcome =
  | { kind: "cut"; shape: number; atMs: number; share: number; cost: number; survived: boolean; cut: FairSplitCut }
  | { kind: "timeout"; shape: number; atMs: number };

/**
 * Plays the cuts up to `endMs`: the shape on screen (`round`), when it appeared and its deadline,
 * each shape's cost, the bank, the last turn's outcome and whether the run is over. Cuts during
 * the pieces and the 3-2-1 before a shape are ignored; a cut after the deadline is a missed limit.
 */
export function play(params: FairSplitParams, { cuts, endMs }: FairSplitInputs) {
  const costs: number[] = [];
  let appearsAt = ROUND_COUNTDOWN_MS;
  let last: FairSplitOutcome | null = null;
  const over = () => costs.length === params.shapes.length || playBank(params.bank, costs).failed;
  const deadline = () => appearsAt + params.shapes[costs.length].limitMs;
  const missed = () => {
    last = { kind: "timeout", shape: costs.length, atMs: deadline() };
    costs.push(MISSED_COST);
  };
  for (const cut of cuts) {
    if (over()) break;
    if (cut.atMs < appearsAt) continue;
    if (cut.atMs > deadline()) {
      missed();
      break;
    }
    const share = splitShare(params.shapes[costs.length].polygon, { x: cut.ax, y: cut.ay }, { x: cut.bx, y: cut.by });
    const shape = costs.length;
    costs.push(cutCost(share));
    last = { kind: "cut", shape, atMs: cut.atMs, share, cost: costs[shape], survived: !playBank(params.bank, costs).failed, cut };
    appearsAt = cut.atMs + GAP_MS;
  }
  if (!over() && endMs > deadline()) missed();
  const finished = over();
  const { survived, left, failed } = playBank(params.bank, costs);
  return {
    round: Math.min(costs.length, params.shapes.length - 1),
    costs,
    survived,
    left,
    failed,
    appearsAt,
    deadline: finished ? null : deadline(),
    // `last` is assigned inside closures TypeScript cannot follow, so it still narrows it to null.
    last: last as FairSplitOutcome | null,
    finished,
  };
}

const coordinate = z.number().min(0).max(BOX);
const inputsSchema: z.ZodType<FairSplitInputs> = z
  .object({
    cuts: z
      .array(z.object({ atMs: z.number().nonnegative().finite(), ax: coordinate, ay: coordinate, bx: coordinate, by: coordinate }))
      .max(ROUNDS)
      .refine((cuts) => cuts.every((cut, i) => i === 0 || cut.atMs > cuts[i - 1].atMs), "cut times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ cuts, endMs }) => endMs >= (cuts.at(-1)?.atMs ?? 0), "the run cannot end before its last cut");

export const fairSplit: ChallengeModule<FairSplitParams, FairSplitInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { survived, left } = play(params, inputs);
    return bankScore(survived, left, params.bank);
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  // The game's clock runs through every 3-2-1 and every pause, so the run's end already holds them.
  lastInputMs: ({ endMs }) => endMs,
};
