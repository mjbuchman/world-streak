import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { ROUNDS, ROUND_COUNTDOWN_MS, SHOW_MS, bankShot, flight, paramsFromSeed, type BankShotParams, type BankShotTap } from "./engine";
import { BOARD_W } from "./geometry";

/**
 * The simulated player that sets BANK_UNITS (T231): it aims at the true crossing with Gaussian
 * error of standard deviation 0.9 + 0.8 per bounce units, 2 more past a spinning bumper, and taps
 * 3 s after the glimpse. A proxy until real play-test numbers replace it (owner to confirm).
 */
function survivesAll(seed: number, params: BankShotParams, errorScale: number): boolean {
  const rng = createRng(seed ^ 0x5eed);
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
  const taps: BankShotTap[] = [];
  let launch = ROUND_COUNTDOWN_MS;
  params.rounds.forEach((round, k) => {
    const sd = (0.9 + 0.8 * round.bounces + (round.bumper ? 2 : 0)) * errorScale;
    const atMs = launch + round.glimpseMs + 3000;
    taps.push({ round: k, atMs, x: Math.min(BOARD_W, Math.max(0, flight(round).crossing.x + sd * gaussian())) });
    launch = atMs + SHOW_MS + ROUND_COUNTDOWN_MS;
  });
  return bankShot.score(params, { taps, endMs: taps[ROUNDS - 1].atMs }) >= ROUNDS;
}

describe("Bank Shot bank size (T231)", () => {
  it("lets 40 to 60% of careful players, under 15% of loose ones and every perfect one survive all five", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (errorScale: number) => all.filter((params, seed) => survivesAll(seed, params, errorScale)).length / all.length;
    const careful = rate(1);
    expect(careful).toBeGreaterThanOrEqual(0.4);
    expect(careful).toBeLessThanOrEqual(0.6);
    expect(rate(2)).toBeLessThan(0.15);
    expect(rate(0)).toBe(1);
  }, 120_000);
});
