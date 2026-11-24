import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { PROMPTS_PER_ROUND, PROMPT_GAP_MS, ROUNDS, ROUND_COUNTDOWN_MS, answerOf, arrowFlip, paramsFromSeed, type ArrowFlipAnswer, type ArrowFlipParams } from "./engine";

/**
 * The simulated player that sets BANK_MS (T236). A careful player reacts in 450 to 700 ms
 * (uniform) plus 100 ms per round after the first, and answers a mismatched prompt with its other
 * direction (the one the cue did not ask for) with a chance rising evenly from 4% in round 1 to
 * 14% in round 5; matched prompts are always right. A distracted player has three times the wrong
 * rate. A proxy until real play-test numbers replace it (owner to confirm).
 */
function survivesAll(seed: number, params: ArrowFlipParams, wrongScale: number): boolean {
  const rng = createRng(seed ^ 0xa770);
  const answers: ArrowFlipAnswer[] = [];
  let appears = ROUND_COUNTDOWN_MS;
  params.rounds.forEach((round, k) => {
    const wrongRate = (0.04 + 0.025 * k) * wrongScale;
    round.prompts.forEach((prompt, i) => {
      const atMs = appears + 450 + 250 * rng.next() + 100 * k;
      const right = answerOf(prompt);
      const slip = prompt.arrow !== prompt.word && rng.next() < wrongRate;
      answers.push({ prompt: k * PROMPTS_PER_ROUND + i, atMs, dir: slip ? (prompt.cue === "arrow" ? prompt.word : prompt.arrow) : right });
      appears = atMs + PROMPT_GAP_MS + (i === PROMPTS_PER_ROUND - 1 ? ROUND_COUNTDOWN_MS : 0);
    });
  });
  return arrowFlip.score(params, { answers, endMs: answers.at(-1)!.atMs }) >= ROUNDS;
}

describe("Arrow Flip bank size (T236)", () => {
  it("lets 40 to 60% of careful players and under 15% of distracted ones survive all five", () => {
    const all = Array.from({ length: 2000 }, (_, seed) => paramsFromSeed(seed));
    const rate = (wrongScale: number) => all.filter((params, seed) => survivesAll(seed, params, wrongScale)).length / all.length;
    const careful = rate(1);
    expect(careful).toBeGreaterThanOrEqual(0.4);
    expect(careful).toBeLessThanOrEqual(0.6);
    expect(rate(3)).toBeLessThan(0.15);
  }, 120_000);
});
