import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { ROUNDS, ROUND_COUNTDOWN_MS, SHOW_MS, bankShot, flight, paramsFromSeed, type BankShotParams, type BankShotTap } from "./engine";
import { BOARD_W } from "./geometry";

/**
 * The simulated player (T231): it aims at the true crossing with Gaussian error of standard
 * deviation 0.9 + 0.8 per bounce units, 2 more past a spinning bumper, and taps 3 s after the
 * glimpse. T231 fitted a 14 unit bank to it, which the owner found too unforgiving in play, so it
 * underrates real error. Since T247 the owner's bank of 30 is fixed and this test only guards the
 * spread it gives: careful players nearly always survive, sloppier ones less often (owner to confirm).
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

describe("Bank Shot bank size (T247)", () => {
  it("lets every perfect player, nearly every careful one and fewer sloppy ones survive all five", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (errorScale: number) => all.filter((params, seed) => survivesAll(seed, params, errorScale)).length / all.length;
    // Measured at T247: 100%, 100%, 93.8% and 64.5%.
    expect(rate(0)).toBe(1);
    expect(rate(1)).toBeGreaterThanOrEqual(0.99);
    const sloppy = rate(2);
    expect(sloppy).toBeGreaterThanOrEqual(0.85);
    expect(sloppy).toBeLessThanOrEqual(0.98);
    const loose = rate(3);
    expect(loose).toBeGreaterThanOrEqual(0.5);
    expect(loose).toBeLessThanOrEqual(0.8);
  }, 120_000);
});
