import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { RUN_COUNTDOWN_MS, STRETCH, WORDS, WORD_GAP_MS, ink, paramsFromSeed, type InkAnswer, type InkParams } from "./engine";

/**
 * The simulated player that sets BANK_MS and WRONG_COST_MS (T249, re-set for one run in T254). A
 * careful player reacts in 550 to 900 ms (uniform) plus 60 ms per stretch of eight words after the
 * first, and answers a mismatched word with the word's own name with a chance rising evenly from 4% in
 * the first stretch to 12% in the last; matched words are always right. A distracted player has
 * three times the wrong rate. Its slowest answer (1 140 ms) is inside the limit, so it never misses a
 * word; slow and wrong answers alone drain the bank. A proxy until real play-test numbers replace it
 * (owner to confirm).
 */
function survivesAll(seed: number, params: InkParams, wrongScale: number): boolean {
  const rng = createRng(seed ^ 0x1c0);
  const answers: InkAnswer[] = [];
  let appears = RUN_COUNTDOWN_MS;
  params.words.forEach((word, w) => {
    const stretch = Math.floor(w / STRETCH);
    const wrongRate = (0.04 + 0.02 * stretch) * wrongScale;
    const atMs = appears + 550 + 350 * rng.next() + 60 * stretch;
    const slip = word.word !== word.ink && rng.next() < wrongRate;
    answers.push({ word: w, atMs, colour: slip ? word.word : word.ink });
    appears = atMs + WORD_GAP_MS;
  });
  return ink.score(params, { answers, endMs: answers.at(-1)!.atMs }) >= WORDS;
}

describe("Ink bank size (T254)", () => {
  it("lets 50 to 70% of careful players and under 15% of distracted ones survive all 40 words", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (wrongScale: number) => all.filter((params, seed) => survivesAll(seed, params, wrongScale)).length / all.length;
    // Measured at BANK_MS 3 200 and WRONG_COST_MS 1 000: careful 59.6%, distracted 1.7% (3 000: 54.9%; 3 500: 75.4%).
    expect(rate(1)).toBeGreaterThanOrEqual(0.5);
    expect(rate(1)).toBeLessThanOrEqual(0.7);
    expect(rate(3)).toBeLessThan(0.15);
  }, 120_000);
});
