import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import {
  BOUNCES,
  BUMPER_ROUNDS,
  CORNER_MARGIN,
  EDGE_MARGIN,
  GLIMPSE_MS,
  ROUNDS,
  ROUND_COUNTDOWN_MS,
  SHOW_MS,
  TAP_LIMIT_MS,
  bankShot,
  drawRound,
  flight,
  isValidRound,
  paramsFromSeed,
  play,
  tapCost,
  type BankShotParams,
  type BankShotRound,
  type BankShotTap,
} from "./engine";
import { BOARD_W } from "./geometry";

// The hand-worked T230 shot: one bounce off the right wall, crossing at x = 75.
const shot: BankShotRound = { start: { x: 50, y: 150 }, velocity: { x: 0.05, y: -0.1 }, bounces: 1, glimpseMs: 1000 };
const params: BankShotParams = { bank: 30, rounds: Array.from({ length: ROUNDS }, () => shot) };

/** Taps landing `misses[k]` right of the crossing, `wait` ms after each glimpse ends, and the run's end. */
function run(misses: number[], wait = 500) {
  const taps: BankShotTap[] = [];
  let launch = ROUND_COUNTDOWN_MS;
  for (const [round, miss] of misses.entries()) {
    const atMs = launch + shot.glimpseMs + wait;
    taps.push({ round, atMs, x: 75 + miss });
    launch = atMs + SHOW_MS + ROUND_COUNTDOWN_MS;
  }
  return { taps, endMs: (taps.at(-1)?.atMs ?? 0) + SHOW_MS };
}

describe("Bank Shot params (T231)", () => {
  // Drawing past a bumper steps the flight, so the sample is drawn once for every test here.
  const sample = Array.from({ length: 300 }, (_, seed) => paramsFromSeed(seed));

  it("draws five valid rounds with the bounce and glimpse ladders and bumpers in rounds 4 and 5", () => {
    for (const { rounds, bank } of sample) {
      expect(bank).toBe(14);
      expect(rounds.map((r) => r.bounces)).toEqual([...BOUNCES]);
      expect(rounds.map((r) => r.glimpseMs)).toEqual([...GLIMPSE_MS]);
      rounds.forEach((round) => expect(isValidRound(round)).toBe(true));
    }
  }, 60_000);

  it("keeps every crossing clear of the walls and every bounce clear of the corners", () => {
    for (const { rounds } of sample) {
      for (const round of rounds) {
        const { crossing, hits } = flight(round);
        expect(crossing.x).toBeGreaterThanOrEqual(EDGE_MARGIN);
        expect(crossing.x).toBeLessThanOrEqual(BOARD_W - EDGE_MARGIN);
        expect(hits).toHaveLength(round.bounces);
        hits.forEach((h) => expect(h.y).toBeGreaterThanOrEqual(CORNER_MARGIN));
      }
    }
  }, 60_000);

  it("gives most bumper rounds a bumper, and only those rounds", () => {
    const counts = [0, 0, 0, 0, 0];
    for (const { rounds } of sample) rounds.forEach((r, k) => (counts[k] += r.bumper ? 1 : 0));
    counts.forEach((n, k) => (BUMPER_ROUNDS.includes(k) ? expect(n).toBeGreaterThan(270) : expect(n).toBe(0)));
  }, 60_000);

  it("falls back to a fixed valid shot with no bumper when no draw is valid", () => {
    for (let k = 0; k < ROUNDS; k++) {
      const round = drawRound(createRng(1), k, 0);
      expect(round).toMatchObject({ start: { x: 30, y: 150 }, bounces: BOUNCES[k], glimpseMs: GLIMPSE_MS[k] });
      expect(round.bumper).toBeUndefined();
      expect(isValidRound(round)).toBe(true);
      expect(flight(round).crossing.x).toBeCloseTo(70, 9);
    }
  });

  it("rejects a round whose bumper sends the puck back for good", () => {
    const trapped = { ...shot, velocity: { x: 0, y: -0.1 }, bumper: { center: { x: 50, y: 75 }, length: 20, omegaPerMs: 0, phase: 0 } };
    expect(isValidRound(trapped)).toBe(false);
    expect(() => flight(trapped)).toThrow(RangeError);
  });

  it("varies the shots by seed", () => {
    const firsts = new Set(Array.from({ length: 500 }, (_, seed) => drawRound(createRng(seed), 0).start.x));
    expect(firsts.size).toBe(500);
  });

  it.each([0, 1, 4_294_967_295])("golden: seed %i (changing the PRNG or the draw changes these)", (seed) => {
    const r3 = (n: number) => Math.round(n * 1000) / 1000;
    const rounds = paramsFromSeed(seed).rounds.map((r) => ({ x0: r3(r.start.x), vx: r3(r.velocity.x * 1000), crossing: r3(flight(r).crossing.x), bumper: r.bumper ? r3(r.bumper.center.x) : null }));
    expect(rounds).toMatchSnapshot();
  });
});

describe("Bank Shot score (T231)", () => {
  it("costs a tap its distance from the crossing, to 0.01", () => {
    expect(tapCost(77.004, 75)).toBe(2);
    expect(tapCost(72.456, 75)).toBe(2.54);
    expect(tapCost(75, 75)).toBe(0);
  });

  it("scores 6 for taps on every crossing", () => {
    expect(bankShot.score(params, run([0, 0, 0, 0, 0]))).toBe(6);
  });

  it("scores 5.333 for misses of 2 to 6 on a 30 unit bank", () => {
    expect(bankShot.score(params, run([2, 3, 4, 5, -6]))).toBe(5.333);
  });

  it("survives a miss of exactly what is left and ends the run 0.01 above it", () => {
    expect(bankShot.score(params, run([10, 10, 10, 0, 0]))).toBe(5);
    expect(bankShot.score(params, run([10, 10, 10.01, 0, 0]))).toBe(2);
    expect(bankShot.finished(params, run([10, 10, 10.01]))).toBe(true);
  });

  it("scores 0 with no tap in round 1, once the tap limit has passed", () => {
    const limit = ROUND_COUNTDOWN_MS + shot.glimpseMs + TAP_LIMIT_MS;
    expect(bankShot.finished(params, { taps: [], endMs: limit })).toBe(false);
    expect(bankShot.score(params, { taps: [], endMs: limit + 1 })).toBe(0);
    expect(play(params, { taps: [], endMs: limit + 1 }).last).toEqual({ kind: "timeout", round: 0, atMs: limit });
  });

  it("treats a tap after the limit as no tap", () => {
    const late = ROUND_COUNTDOWN_MS + shot.glimpseMs + TAP_LIMIT_MS + 1;
    expect(bankShot.score(params, { taps: [{ round: 0, atMs: late, x: 75 }], endMs: late })).toBe(0);
  });

  it("ignores a tap before the glimpse ends and counts a later one", () => {
    const glimpseEnd = ROUND_COUNTDOWN_MS + shot.glimpseMs;
    const taps = [
      { round: 0, atMs: glimpseEnd - 1, x: 0 },
      { round: 0, atMs: glimpseEnd, x: 76 },
    ];
    const state = play(params, { taps, endMs: glimpseEnd });
    expect(state.costs).toEqual([1]);
    expect(state.last).toMatchObject({ kind: "tap", round: 0, crossingX: 75, cost: 1, survived: true });
    expect(state.launchAt).toBe(glimpseEnd + SHOW_MS + ROUND_COUNTDOWN_MS);
  });

  it("ignores taps meant for another round and taps after the run ended", () => {
    const { taps, endMs } = run([31, 0, 0]);
    expect(bankShot.score(params, { taps, endMs })).toBe(0);
    expect(play(params, { taps: [{ ...taps[0], round: 1 }], endMs: taps[0].atMs }).costs).toEqual([]);
  });

  it("reports the round on screen and its timings until the run is over", () => {
    const partial = play(params, run([1, 2]));
    expect(partial).toMatchObject({ round: 2, survived: 2, left: 27, finished: false });
    expect(partial.deadline).toBe((partial.glimpseEnd ?? 0) + TAP_LIMIT_MS);
    const done = play(params, run([0, 0, 0, 0, 0]));
    expect(done).toMatchObject({ round: ROUNDS - 1, finished: true, glimpseEnd: null, deadline: null });
  });

  it("validates inputs and reports the run's end as the last input", () => {
    const ok = run([0, 0]);
    expect(bankShot.inputsSchema.safeParse(ok).success).toBe(true);
    expect(bankShot.lastInputMs(ok, params)).toBe(ok.endMs);
    const bad = [
      { ...ok, taps: [...run([0, 0, 0, 0, 0]).taps, { round: 4, atMs: 1e9, x: 1 }] },
      { ...ok, taps: [{ round: 0, atMs: 1, x: BOARD_W + 0.1 }] },
      { ...ok, taps: [{ round: ROUNDS, atMs: 1, x: 1 }] },
      { ...ok, taps: [ok.taps[1], ok.taps[0]] },
      { ...ok, endMs: ok.taps[1].atMs - 1 },
    ];
    bad.forEach((inputs) => expect(bankShot.inputsSchema.safeParse(inputs).success).toBe(false));
  });

  it("is deterministic and stays within 0 to ROUNDS + 1 over seeds 0 to 999", () => {
    expect(bankShot.direction).toBe("higher-better");
    for (let seed = 0; seed < 1000; seed++) {
      const p = paramsFromSeed(seed);
      const rng = createRng(seed);
      const taps: BankShotTap[] = [];
      let launch = ROUND_COUNTDOWN_MS;
      p.rounds.forEach((round, k) => {
        const atMs = launch + round.glimpseMs + rng.int(0, 4000);
        taps.push({ round: k, atMs, x: rng.next() * BOARD_W });
        launch = atMs + SHOW_MS + ROUND_COUNTDOWN_MS;
      });
      const inputs = { taps, endMs: taps[4].atMs };
      const score = bankShot.score(p, inputs);
      expect(bankShot.score(p, inputs)).toBe(score);
      if (seed < 50) expect(bankShot.score(paramsFromSeed(seed), inputs)).toBe(score);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(ROUNDS + 1);
    }
  }, 60_000);
});
