import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { RUN_COUNTDOWN_MS, STRETCH, WORDS, WORD_GAP_MS, ink, paramsFromSeed, type InkAnswer, type InkParams } from "./engine";

/**
 * The simulated player behind BANK_MS and WRONG_COST_MS (T249, one run in T254, 30 words in T258). A
 * careful player reacts in 550 to 900 ms (uniform) plus 7.5 ms per word already played, and answers a
 * mismatched word with the word's own name with a chance rising evenly from 4% in the first stretch
 * to 12% in the last; matched words are always right. A distracted player has three times the wrong
 * rate. Its slowest answer (about 1 120 ms) is inside the limit, so it never misses a
 * word; slow and wrong answers alone drain the bank. A proxy until real play-test numbers replace it
 * (owner to confirm).
 */
function survivesAll(seed: number, params: InkParams, wrongScale: number): boolean {
  const rng = createRng(seed ^ 0x1c0);
  const answers: InkAnswer[] = [];
  let appears = RUN_COUNTDOWN_MS;
  params.words.forEach((word, w) => {
    const stretch = Math.floor(w / STRETCH);
    const wrongRate = (0.04 + (0.08 * stretch) / (WORDS / STRETCH - 1)) * wrongScale;
    const atMs = appears + 550 + 350 * rng.next() + 7.5 * w;
    const slip = word.word !== word.ink && rng.next() < wrongRate;
    answers.push({ word: w, atMs, colour: slip ? word.word : word.ink });
    appears = atMs + WORD_GAP_MS;
  });
  return ink.score(params, { answers, endMs: answers.at(-1)!.atMs }) >= WORDS;
}

describe("Ink bank size (T254, T258)", () => {
  it("records how many careful and distracted players survive all 30 words on the owner's 3.2 s bank", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (wrongScale: number) => all.filter((params, seed) => survivesAll(seed, params, wrongScale)).length / all.length;
    // Measured at 30 words, BANK_MS 3 200 and WRONG_COST_MS 1 000: careful 87.3%, distracted 15.1%
    // (at 40 words it was 59.6% and 1.7%). The owner kept the bank, so these bounds only catch drift.
    expect(rate(1)).toBeGreaterThanOrEqual(0.8);
    expect(rate(1)).toBeLessThanOrEqual(0.95);
    expect(rate(3)).toBeLessThan(0.25);
  }, 120_000);
});
