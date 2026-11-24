import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { ROUNDS, ROUND_COUNTDOWN_MS, WORDS_PER_ROUND, WORD_GAP_MS, ink, paramsFromSeed, type InkAnswer, type InkParams } from "./engine";

/**
 * The simulated player that sets BANK_MS and WRONG_COST_MS (T249). A careful player reacts in 550 to
 * 900 ms (uniform) plus 60 ms per round after the first, and answers a mismatched word with the word's
 * own name with a chance rising evenly from 4% in round 1 to 12% in round 5; matched words are always
 * right. A distracted player has three times the wrong rate. Its slowest answer (1 140 ms in round 5)
 * is inside every limit, so it never misses a word; slow and wrong answers alone drain the bank. A
 * proxy until real play-test numbers replace it (owner to confirm).
 */
function survivesAll(seed: number, params: InkParams, wrongScale: number): boolean {
  const rng = createRng(seed ^ 0x1c0);
  const answers: InkAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  params.rounds.forEach((round, k) => {
    const wrongRate = (0.04 + 0.02 * k) * wrongScale;
    round.words.forEach((word, i) => {
      const atMs = appears + 550 + 350 * rng.next() + 60 * k;
      const slip = word.word !== word.ink && rng.next() < wrongRate;
      answers.push({ word: k * WORDS_PER_ROUND + i, atMs, colour: slip ? word.word : word.ink });
      appears = atMs + WORD_GAP_MS + (i === WORDS_PER_ROUND - 1 ? ROUND_COUNTDOWN_MS : 0);
    });
  });
  return ink.score(params, { answers, endMs: answers.at(-1)!.atMs }) >= ROUNDS;
}

describe("Ink bank size (T249)", () => {
  it("lets 50 to 70% of careful players and under 15% of distracted ones survive all five", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (wrongScale: number) => all.filter((params, seed) => survivesAll(seed, params, wrongScale)).length / all.length;
    // Measured at BANK_MS 4 000 and WRONG_COST_MS 1 000: careful 60.5%, distracted 3.6%.
    expect(rate(1)).toBeGreaterThanOrEqual(0.5);
    expect(rate(1)).toBeLessThanOrEqual(0.7);
    expect(rate(3)).toBeLessThan(0.15);
  }, 120_000);
});
