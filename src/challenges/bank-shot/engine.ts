import { z } from "zod";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { bankScore, playBank } from "../shared/bank";
import { createRng, type Rng } from "../shared/prng";
import type { ChallengeModule } from "../shared/types";
import { BOARD_H, BOARD_W, traceStraight, traceWithBar, unfoldedX, type RotatingBar, type Trace, type Vec } from "./geometry";

/**
 * Bank Shot (T231): five shots, each glimpsed for a moment before the puck is hidden; the player
 * taps where it will cross the finish line. A tap costs its distance from the real crossing, in
 * board units, against a bank; a tap that does not fit what is left ends the run, and no tap by the
 * limit costs the board's width, which no bank survives. Score = shots survived + bank left as a
 * fraction (T180). Every number below is a proposal, owner to confirm (DECISIONS, T244).
 */

export const ROUNDS = 5;
/** The bank, in board units, set so about half of simulated careful players survive all five. */
export const BANK_UNITS = 14;
export const BOUNCES = [1, 1, 2, 3, 4] as const;
export const GLIMPSE_MS = [1600, 1400, 1200, 1000, 800] as const;
/** Rounds (from 0) with a spinning bumper. */
export const BUMPER_ROUNDS: readonly number[] = [3, 4];
/** The real crossing stays this far inside the side walls. */
export const EDGE_MARGIN = 6;
/** No bounce this close to the top or bottom of a wall. */
export const CORNER_MARGIN = 4;
/** A straight flight takes this long, bottom to finish line. */
export const FLIGHT_MS = { min: 2400, max: 3200 } as const;
/** A shot past a bumper must cross by then. */
export const MAX_FLIGHT_MS = 6000;
export const BUMPER_LENGTH = 24;
/** How long after the glimpse ends the player has to tap. */
export const TAP_LIMIT_MS = 10_000;
/** How long the real path stays on screen after a tap. */
export const SHOW_MS = 1200;
/** The 3-2-1 before every shot. */
export const ROUND_COUNTDOWN_MS = RUN_COUNTDOWN_MS;
/** What no tap costs: the most a tap can be off, so no bank survives it. */
export const MISSED_COST = BOARD_W;
/** Draws tried before a round falls back to its fixed shot. */
export const DRAW_TRIES = 20;

export type BankShotRound = { start: Vec; velocity: Vec; bounces: number; glimpseMs: number; bumper?: RotatingBar };
export type BankShotParams = { bank: number; rounds: BankShotRound[] };
/** A tap at board x on the finish line, `atMs` from the game's start, meant for round `round` (from 0). */
export type BankShotTap = { round: number; atMs: number; x: number };
export type BankShotInputs = { taps: BankShotTap[]; endMs: number };

/** The shot's real path: straight by the closed form, or stepped past its bumper. */
export function flight(round: BankShotRound): Trace {
  if (!round.bumper) return traceStraight(round.start, round.velocity);
  const trace = traceWithBar(round.start, round.velocity, round.bumper, MAX_FLIGHT_MS);
  if (!trace) throw new RangeError("this shot never reaches the finish line");
  return trace;
}

/**
 * A straight shot from `x0` that bounces `bounces` times and crosses at `c` after `flightMs`,
 * moving right (`dir` 1) or left (-1). Unfolded, the walls are the multiples of BOARD_W, so the end
 * point lies past `bounces` of them; a leftward shot is the mirror image of a rightward one.
 */
function shotFor(x0: number, c: number, bounces: number, dir: 1 | -1, flightMs: number): Pick<BankShotRound, "start" | "velocity"> {
  const from = dir > 0 ? x0 : BOARD_W - x0;
  const to = dir > 0 ? c : BOARD_W - c;
  const end = bounces % 2 ? (bounces + 1) * BOARD_W - to : bounces * BOARD_W + to;
  return { start: { x: x0, y: BOARD_H }, velocity: { x: (dir * (end - from)) / flightMs, y: -BOARD_H / flightMs } };
}

const between = (rng: Rng, min: number, max: number) => min + rng.next() * (max - min);

function candidate(rng: Rng, k: number): BankShotRound {
  const shot = shotFor(between(rng, 10, BOARD_W - 10), between(rng, EDGE_MARGIN, BOARD_W - EDGE_MARGIN), BOUNCES[k], rng.next() < 0.5 ? 1 : -1, between(rng, FLIGHT_MS.min, FLIGHT_MS.max));
  const round: BankShotRound = { ...shot, bounces: BOUNCES[k], glimpseMs: GLIMPSE_MS[k] };
  if (!BUMPER_ROUNDS.includes(k)) return round;
  // The bumper sits near the straight path's middle, so it usually changes the shot.
  const at = between(rng, 0.3, 0.6) * (BOARD_H / -shot.velocity.y);
  const x = unfoldedX(shot.start.x, shot.velocity.x, at, BOARD_W) + between(rng, -6, 6);
  const spin = between(rng, 0.002, 0.004) * (rng.next() < 0.5 ? 1 : -1);
  return { ...round, bumper: { center: { x, y: shot.start.y + shot.velocity.y * at }, length: BUMPER_LENGTH, omegaPerMs: spin, phase: between(rng, 0, Math.PI) } };
}

/** Fair by construction: the crossing clear of the walls, no bounce near a corner, the right bounce count, in time. */
export function isValidRound(round: BankShotRound): boolean {
  let trace: Trace;
  try {
    trace = flight(round);
  } catch {
    return false;
  }
  const { crossing, hits } = trace;
  return (
    hits.length === round.bounces &&
    crossing.x >= EDGE_MARGIN &&
    crossing.x <= BOARD_W - EDGE_MARGIN &&
    crossing.atMs <= MAX_FLIGHT_MS &&
    hits.every((h) => h.y >= CORNER_MARGIN && h.y <= BOARD_H - CORNER_MARGIN) &&
    (!round.bumper || (round.bumper.center.x >= 12 && round.bumper.center.x <= BOARD_W - 12))
  );
}

/** Round `k` drawn from `rng`, or its fixed shot (no bumper) if no draw in `tries` is valid. */
export function drawRound(rng: Rng, k: number, tries = DRAW_TRIES): BankShotRound {
  for (let i = 0; i < tries; i++) {
    const round = candidate(rng, k);
    if (isValidRound(round)) return round;
  }
  return { ...shotFor(30, 70, BOUNCES[k], 1, 2800), bounces: BOUNCES[k], glimpseMs: GLIMPSE_MS[k] };
}

export function paramsFromSeed(seed: number): BankShotParams {
  const rng = createRng(seed);
  return { bank: BANK_UNITS, rounds: Array.from({ length: ROUNDS }, (_, k) => drawRound(rng, k)) };
}

/** A tap's distance from the real crossing, to 0.01 units. */
export const tapCost = (x: number, crossingX: number) => Math.round(Math.abs(x - crossingX) * 100) / 100;

/** How a round ended: a tap (where, the real crossing and its cost) or no tap by the limit. */
export type BankShotOutcome =
  | { kind: "tap"; round: number; atMs: number; x: number; crossingX: number; cost: number; survived: boolean }
  | { kind: "timeout"; round: number; atMs: number };

/**
 * Plays the taps up to `endMs`: the round on screen, when its puck launched, when its glimpse ends
 * and its tap limit, each round's cost, the bank, the last outcome and whether the run is over.
 * Taps for another round, or before the glimpse ends, are ignored; one after the limit is a miss.
 */
export function play(params: BankShotParams, { taps, endMs }: BankShotInputs) {
  const costs: number[] = [];
  let launchAt = ROUND_COUNTDOWN_MS;
  let last: BankShotOutcome | null = null;
  const over = () => costs.length === params.rounds.length || playBank(params.bank, costs).failed;
  const glimpseEnd = () => launchAt + params.rounds[costs.length].glimpseMs;
  const deadline = () => glimpseEnd() + TAP_LIMIT_MS;
  const missed = () => {
    last = { kind: "timeout", round: costs.length, atMs: deadline() };
    costs.push(MISSED_COST);
  };
  for (const tap of taps) {
    if (over()) break;
    if (tap.round !== costs.length || tap.atMs < glimpseEnd()) continue;
    if (tap.atMs > deadline()) {
      missed();
      break;
    }
    const round = costs.length;
    const crossingX = flight(params.rounds[round]).crossing.x;
    costs.push(tapCost(tap.x, crossingX));
    last = { kind: "tap", round, atMs: tap.atMs, x: tap.x, crossingX, cost: costs[round], survived: !playBank(params.bank, costs).failed };
    launchAt = tap.atMs + SHOW_MS + ROUND_COUNTDOWN_MS;
  }
  if (!over() && endMs > deadline()) missed();
  const finished = over();
  const { survived, left, failed } = playBank(params.bank, costs);
  return {
    round: Math.min(costs.length, params.rounds.length - 1),
    costs,
    survived,
    left,
    failed,
    launchAt,
    glimpseEnd: finished ? null : glimpseEnd(),
    deadline: finished ? null : deadline(),
    // `last` is assigned inside closures TypeScript cannot follow, so it still narrows it to null.
    last: last as BankShotOutcome | null,
    finished,
  };
}

const inputsSchema: z.ZodType<BankShotInputs> = z
  .object({
    taps: z
      .array(z.object({ round: z.number().int().min(0).max(ROUNDS - 1), atMs: z.number().nonnegative().finite(), x: z.number().min(0).max(BOARD_W) }))
      .max(ROUNDS)
      .refine((taps) => taps.every((tap, i) => i === 0 || tap.atMs > taps[i - 1].atMs), "tap times must rise"),
    endMs: z.number().nonnegative().finite(),
  })
  .refine(({ taps, endMs }) => endMs >= (taps.at(-1)?.atMs ?? 0), "the run cannot end before its last tap");

export const bankShot: ChallengeModule<BankShotParams, BankShotInputs> = {
  paramsFromSeed,
  score: (params, inputs) => {
    const { survived, left } = play(params, inputs);
    return bankScore(survived, left, params.bank);
  },
  finished: (params, inputs) => play(params, inputs).finished,
  inputsSchema,
  direction: "higher-better",
  // The game's clock runs through every 3-2-1 and every reveal, so the run's end already holds them.
  lastInputMs: ({ endMs }) => endMs,
};
