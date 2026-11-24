import { describe, expect, it } from "vitest";
import { INK_COLOR_TOKENS } from "@/components/canvasTokens";
import { PALETTE, contrastRatio } from "@/lib/theme/palette";
import type { InkWord } from "./engine";
import { INK_SWATCHES } from "./palette";
import { FEEDBACK_PX, MIN_WORD_PX, SLIDE_MS, drawInk, limitFraction, slideOffset, wordLayout, type InkFrame } from "./render";

type Call = { name: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown; font: unknown };

function recorder() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, name: string) =>
      name in target ? target[name] : (...args: unknown[]) => calls.push({ name, args, fillStyle: target.fillStyle, strokeStyle: target.strokeStyle, font: target.font }),
    set: (target, name: string, value) => ((target[name] = value), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const colors = { board: "#b", halo: "#h", red: "#red", blue: "#blue", yellow: "#yel", black: "#blk", right: "#r", wrong: "#x", bar: "#l", track: "#t", text: "#txt" };
const mismatch: InkWord = { word: "blue", ink: "yellow" };
const frame = (over: Partial<InkFrame> = {}): InkFrame => ({
  width: 390,
  height: 560,
  devicePixelRatio: 2,
  word: mismatch,
  msSinceWord: 500,
  limitMs: 2000,
  feedback: null,
  reducedMotion: false,
  colors,
  ...over,
});
function draw(over: Partial<InkFrame> = {}) {
  const { ctx, calls } = recorder();
  drawInk(ctx, frame(over));
  return calls;
}
const named = (calls: Call[], name: string) => calls.filter((c) => c.name === name);
const texts = (calls: Call[]) => named(calls, "fillText").map((c) => c.args[0]);
const fontPx = (call: Call) => Number(/(\d+)px/.exec(String(call.font))![1]);

describe("Ink layout (T250)", () => {
  it.each([
    [220, 203],
    [232, 214],
    [320, 480],
    [390, 560],
  ])("keeps the word centred and inside a %i x %i canvas, above the bar", (w, h) => {
    const { word, mark, bar, fontPx: px } = wordLayout(w, h);
    expect(word.cx).toBe(w / 2);
    expect(word.cx - word.w / 2).toBeGreaterThanOrEqual(0);
    expect(word.cx + word.w / 2).toBeLessThanOrEqual(w);
    expect(word.cy - word.h / 2).toBeGreaterThanOrEqual(0);
    expect(word.cy + word.h / 2 + FEEDBACK_PX * 2).toBeLessThan(bar.y);
    expect(mark.cy - mark.size / 2).toBeGreaterThanOrEqual(0);
    expect(mark.cy + mark.size / 2).toBeLessThan(word.cy - FEEDBACK_PX / 2);
    expect(bar.y + bar.h).toBeLessThanOrEqual(h);
    expect(px).toBeGreaterThanOrEqual(MIN_WORD_PX);
  });

  it("draws the word at least 36 px at 390 px wide", () => {
    expect(wordLayout(390, 560).fontPx).toBeGreaterThanOrEqual(36);
  });

  it("drains the limit bar from full to empty", () => {
    expect(limitFraction(0, 2000)).toBe(1);
    expect(limitFraction(1000, 2000)).toBe(0.5);
    expect(limitFraction(2000, 2000)).toBe(0);
    expect(limitFraction(2500, 2000)).toBe(0);
  });

  it("slides a word in, and not with reduced motion", () => {
    expect(slideOffset(0, 400, false)).toBeCloseTo(32);
    expect(slideOffset(SLIDE_MS, 400, false)).toBe(0);
    expect(slideOffset(0, 400, true)).toBe(0);
  });

  it("maps every canvas colour to a token, the inks to their swatches, and keeps the text 4.5:1 on the board", () => {
    for (const c of ["red", "blue", "yellow", "black"] as const) expect(INK_COLOR_TOKENS[c]).toBe(INK_SWATCHES[c].token);
    const hex = (token: string) => PALETTE[token.replace("--fs-color-", "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof PALETTE];
    expect(contrastRatio(hex(INK_COLOR_TOKENS.text), hex(INK_COLOR_TOKENS.board))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("drawInk (T250)", () => {
  it("draws the word once, in its ink, with no halo for a light ink", () => {
    const calls = draw();
    expect(calls[0]).toMatchObject({ name: "setTransform", args: [2, 0, 0, 2, 0, 0] });
    const words = named(calls, "fillText");
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ args: ["BLUE", expect.any(Number), expect.any(Number)], fillStyle: "#yel" });
    expect(fontPx(words[0])).toBe(wordLayout(390, 560).fontPx);
    expect(named(calls, "strokeText")).toHaveLength(0);
  });

  it("puts a dark ink inside the light halo, drawn under the fill", () => {
    const calls = draw({ word: { word: "red", ink: "black" } });
    const halo = named(calls, "strokeText");
    expect(halo).toHaveLength(1);
    expect(halo[0]).toMatchObject({ args: ["RED", expect.any(Number), expect.any(Number)], strokeStyle: "#h" });
    expect(named(calls, "fillText")[0]).toMatchObject({ args: ["RED", expect.any(Number), expect.any(Number)], fillStyle: "#blk" });
    expect(calls.indexOf(halo[0])).toBeLessThan(calls.indexOf(named(calls, "fillText")[0]));
  });

  it("slides the word in from the right, and centres it at once with reduced motion", () => {
    const cx = wordLayout(390, 560).word.cx;
    expect(named(draw({ msSinceWord: 0 }), "fillText")[0].args[1]).toBeGreaterThan(cx);
    expect(named(draw({ msSinceWord: 0, reducedMotion: true }), "fillText")[0].args[1]).toBe(cx);
    expect(texts(draw({ msSinceWord: 0, reducedMotion: true }))).toEqual(["BLUE"]);
  });

  it.each([
    [0, 1],
    [1000, 0.5],
    [2000, 0],
  ])("draws the limit bar's fill at %i ms to %f of its width", (ms, share) => {
    const bar = draw({ msSinceWord: ms }).filter((c) => c.name === "fillRect" && c.fillStyle === "#l");
    expect(bar[0].args[2]).toBe(wordLayout(390, 560).bar.w * share);
  });

  it("shows a tick for a right answer, and a cross with the right colour's name for a wrong or missed one", () => {
    const right = draw({ feedback: { result: "right", answer: "red" } });
    expect(texts(right)).toEqual(["Right"]);
    expect(right.filter((c) => c.name === "stroke" && c.strokeStyle === "#r")).toHaveLength(1);
    const wrong = draw({ feedback: { result: "wrong", answer: "yellow" } });
    expect(texts(wrong)).toEqual(["Wrong", "It was YELLOW"]);
    expect(wrong.filter((c) => c.name === "stroke" && c.strokeStyle === "#x")).toHaveLength(1);
    expect(texts(draw({ feedback: { result: "timeout", answer: "black" } }))).toEqual(["Too slow", "It was BLACK"]);
    expect(texts(draw({ feedback: { result: "wrong", answer: "red" }, reducedMotion: true }))).toEqual(["Wrong", "It was RED"]);
  });

  it("draws only the board with no word", () => {
    expect(draw({ word: null }).map((c) => c.name)).toEqual(["setTransform", "fillRect"]);
  });
});
