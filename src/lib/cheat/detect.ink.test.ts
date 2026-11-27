import { describe, expect, it } from "vitest";
import { COLOURS, LIMIT_MS, STRETCH, WORDS, WORD_GAP_MS, ink, paramsFromSeed, type InkAnswer, type InkParams } from "@/challenges/ink/engine";
import { createRng } from "@/challenges/shared/prng";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { detectFlags, type DetectArgs } from "./detect";

// The Confusing Colors rules (T240), in their own file beside detect.test.ts.
const PARAMS = paramsFromSeed(1);
/** A bank no run below can drain, so every answer counts unless a test says otherwise. */
const ROOMY: InkParams = { ...PARAMS, bank: 600_000 };

/** One word: answered after `reactionMs` (right, or wrong if `wrong`), or missed when null. */
type Turn = { reactionMs: number | null; wrong?: boolean };

/** Answers word by word, each word appearing the gap after the one before it was settled. */
function inkRun(turns: Turn[], params: InkParams = ROOMY, over: Partial<DetectArgs> = {}): DetectArgs {
  const answers: InkAnswer[] = [];
  let appears = RUN_COUNTDOWN_MS;
  let endMs = 0;
  turns.forEach(({ reactionMs, wrong }, w) => {
    endMs = appears + (reactionMs ?? LIMIT_MS);
    const ink = params.words[w].ink;
    if (reactionMs !== null) answers.push({ word: w, atMs: endMs, colour: wrong ? COLOURS.find((c) => c !== ink)! : ink });
    appears = endMs + WORD_GAP_MS;
  });
  const inputs = { answers, endMs };
  return { challengeType: "ink", inputs, score: ink.score(params, inputs), params, serverElapsedMs: endMs + 4_000, history: [], ...over };
}

const right = (...reactionsMs: number[]): Turn[] => reactionsMs.map((reactionMs) => ({ reactionMs }));
/** Reaction times alternating `d` either side of 600 ms: a standard deviation of exactly d. */
const even = (count: number, d: number) => right(...Array.from({ length: count }, (_, i) => 600 + (i % 2 === 0 ? d : -d)));

it("flags nothing for an honest-looking run: reactions 450 to 1 100 ms, two wrong answers and a miss", () => {
  const turns: Turn[] = [
    ...right(620, 450, 880, 710, 1_100, 540),
    { reactionMs: 760, wrong: true },
    ...right(930, 480, 690),
    { reactionMs: null },
    ...right(820, 1_040, 570),
    { reactionMs: 650, wrong: true },
    ...right(900, 510, 770, 1_010, 600),
  ];
  expect(detectFlags(inkRun(turns))).toEqual([]);
  // On the real 3.2 s bank the run busts; what it played still raises nothing.
  expect(detectFlags(inkRun(turns, PARAMS))).toEqual([]);
});

describe("ink-too-fast", () => {
  it("flags three correct answers under 180 ms in one run", () => {
    expect(detectFlags(inkRun([...right(600, 179, 700), ...right(150, 800, 90, 650)]))).toEqual(["ink-too-fast"]);
  });

  it("allows two, answers of exactly 180 ms, and fast wrong answers", () => {
    expect(detectFlags(inkRun(right(600, 179, 700, 150, 800, 180, 650)))).toEqual([]);
    const wrongFast = [100, 120, 140].map((reactionMs): Turn => ({ reactionMs, wrong: true }));
    expect(detectFlags(inkRun([...wrongFast, ...right(600)]))).toEqual([]);
  });

  it("leaves out answers the game ignored: after the run ended, or for a word already settled", () => {
    // Four wrong answers drain the 3.2 s bank; the quick right ones after it never counted.
    const busted = inkRun([...[600, 600, 600, 600].map((reactionMs): Turn => ({ reactionMs, wrong: true })), ...right(100, 100, 100)], PARAMS);
    expect(detectFlags(busted)).toEqual([]);
    const run = inkRun(right(600, 179, 150));
    const { answers, endMs } = run.inputs as { answers: InkAnswer[]; endMs: number };
    // A repeat for word 2 right after the real one, while word 3 is not up yet.
    const repeat = { word: 2, atMs: endMs + 10, colour: PARAMS.words[2].ink };
    expect(detectFlags({ ...run, inputs: { answers: [...answers, repeat], endMs: endMs + 10 } })).toEqual([]);
    // An answer for word 3 before it appeared (it shows WORD_GAP_MS after word 2's answer).
    const early = { word: 3, atMs: endMs + 10, colour: PARAMS.words[3].ink };
    expect(detectFlags({ ...run, inputs: { answers: [...answers, early], endMs: endMs + 10 } })).toEqual([]);
  });
});

describe("ink-robotic", () => {
  it("flags 12 or more reaction times under 12 ms apart (standard deviation)", () => {
    expect(detectFlags(inkRun(even(12, 11.9)))).toEqual(["ink-robotic"]);
    expect(detectFlags(inkRun(even(30, 0)))).toEqual(["ink-robotic"]);
  });

  it("allows a deviation of 12 ms, or fewer than 12 answers", () => {
    expect(detectFlags(inkRun(even(12, 12)))).toEqual([]);
    expect(detectFlags(inkRun(even(11, 0)))).toEqual([]);
  });

  it("counts reaction times, not the gaps between taps, so missed words do not hide a script", () => {
    // Even reactions with a miss every fourth word: the tap gaps vary, the reactions do not.
    const turns = Array.from({ length: 16 }, (_, i): Turn => ({ reactionMs: i % 4 === 3 ? null : 600 }));
    expect(detectFlags(inkRun(turns))).toEqual(["ink-robotic"]);
  });
});

it("times a Confusing Colors run at its end, with the one opening 3-2-1 in the allowance", () => {
  const allowed = 15_000 + RUN_COUNTDOWN_MS + 2_000;
  const run = inkRun(right(600, 700, 800));
  const { endMs } = run.inputs as { endMs: number };
  expect(detectFlags({ ...run, serverElapsedMs: endMs + allowed })).toEqual([]);
  expect(detectFlags({ ...run, serverElapsedMs: endMs + allowed + 1 })).toEqual(["timing-mismatch"]);
});

it("keeps its rules to its own attempts", () => {
  const scripted = inkRun(right(...Array.from({ length: 12 }, () => 100)));
  expect(detectFlags(scripted)).toEqual(["ink-too-fast", "ink-robotic"]);
  expect(detectFlags({ ...scripted, challengeType: "unknown" })).toEqual([]);
  // A Tower attempt reads its own taps, never an Ink run's answers.
  expect(detectFlags({ ...scripted, challengeType: "stacking", inputs: { tapsMs: [] }, params: { startStepMs: 160, stepDecayMs: 7, startColumn: 2, direction: "right" } })).toEqual([]);
});

/**
 * The careful player of engine.sim.test.ts (T254, T258): 550 to 900 ms plus 7.5 ms a word, and a
 * mismatched word sometimes answered with its name, 4% rising to 12%.
 */
function carefulRun(seed: number): DetectArgs {
  const params = paramsFromSeed(seed);
  const rng = createRng(seed ^ 0x1c0);
  const turns = params.words.map((word, w): Turn => {
    const wrongRate = 0.04 + (0.08 * Math.floor(w / STRETCH)) / (WORDS / STRETCH - 1);
    const reactionMs = 550 + 350 * rng.next() + 7.5 * w;
    return { reactionMs, wrong: word.word !== word.ink && rng.next() < wrongRate };
  });
  return inkRun(turns, params);
}

it("raises no flag for at least 99% of 2 000 simulated careful players", () => {
  const clean = Array.from({ length: 2000 }, (_, seed) => detectFlags(carefulRun(seed))).filter((flags) => flags.length === 0).length;
  expect(clean / 2000).toBeGreaterThanOrEqual(0.99);
}, 120_000);
