import { describe, expect, it } from "vitest";
import { ARROW_FLIP_COLOR_TOKENS } from "@/components/canvasTokens";
import { PALETTE, contrastRatio } from "@/lib/theme/palette";
import type { ArrowFlipPrompt } from "./engine";
import { MIN_TEXT_PX, SLIDE_MS, drawArrowFlip, limitFraction, promptLayout, slideOffset, type ArrowFlipFrame } from "./render";

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

const colors = { board: "#b", arrow: "#a", word: "#w", badge: "#g", right: "#r", wrong: "#x", bar: "#l", track: "#t", text: "#txt" };
const mismatch: ArrowFlipPrompt = { arrow: "left", word: "up", cue: "arrow" };
const frame = (over: Partial<ArrowFlipFrame> = {}): ArrowFlipFrame => ({
  width: 390,
  height: 560,
  devicePixelRatio: 2,
  prompt: mismatch,
  msSincePrompt: 500,
  limitMs: 2000,
  feedback: null,
  reducedMotion: false,
  colors,
  ...over,
});
function draw(over: Partial<ArrowFlipFrame> = {}) {
  const { ctx, calls } = recorder();
  drawArrowFlip(ctx, frame(over));
  return calls;
}
const texts = (calls: Call[]) => calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);
const fontPx = (call: Call) => Number(/(\d+)px/.exec(String(call.font))![1]);

describe("Arrow Flip layout (T237)", () => {
  it.each([
    [320, 480],
    [390, 560],
  ])("keeps the badge, arrow, word and bar inside a %i x %i canvas, in that order down it", (w, h) => {
    const { badge, arrow, word, bar, fontPx: px } = promptLayout(w, h);
    for (const box of [badge, arrow, word]) {
      expect(box.cx - box.w / 2).toBeGreaterThanOrEqual(0);
      expect(box.cx + box.w / 2).toBeLessThanOrEqual(w);
      expect(box.cy - box.h / 2).toBeGreaterThanOrEqual(0);
      expect(box.cy + box.h / 2).toBeLessThanOrEqual(h);
    }
    expect(badge.cy + badge.h / 2).toBeLessThan(arrow.cy - arrow.h / 2);
    expect(arrow.cy + arrow.h / 2).toBeLessThan(word.cy - word.h / 2);
    expect(word.cy + word.h / 2).toBeLessThan(bar.y);
    expect(bar.y + bar.h).toBeLessThanOrEqual(h);
    expect(px).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  });

  it("drains the limit bar from full to empty", () => {
    expect(limitFraction(0, 2000)).toBe(1);
    expect(limitFraction(1000, 2000)).toBe(0.5);
    expect(limitFraction(2000, 2000)).toBe(0);
    expect(limitFraction(2500, 2000)).toBe(0);
  });

  it("slides a prompt in, and not with reduced motion", () => {
    expect(slideOffset(0, 400, false)).toBeCloseTo(32);
    expect(slideOffset(SLIDE_MS, 400, false)).toBe(0);
    expect(slideOffset(0, 400, true)).toBe(0);
  });

  it("keeps the text tokens at least 4.5:1 over the board", () => {
    const hex = (token: string) => PALETTE[token.replace("--fs-color-", "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof PALETTE];
    const board = hex(ARROW_FLIP_COLOR_TOKENS.board);
    for (const token of [ARROW_FLIP_COLOR_TOKENS.text, ARROW_FLIP_COLOR_TOKENS.word]) expect(contrastRatio(hex(token), board)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("drawArrowFlip (T237)", () => {
  it("draws the arrow, the word and the cue's badge once each, the badge reading the cue", () => {
    const calls = draw();
    expect(calls[0]).toMatchObject({ name: "setTransform", args: [2, 0, 0, 2, 0, 0] });
    expect(calls.filter((c) => c.name === "fill" && c.fillStyle === "#a")).toHaveLength(1);
    expect(texts(calls)).toEqual(["ARROW", "UP"]);
    expect(calls.filter((c) => c.name === "fillText").every((c) => fontPx(c) >= MIN_TEXT_PX)).toBe(true);
    expect(calls.filter((c) => c.name === "roundRect")).toHaveLength(0);
    expect(texts(draw({ prompt: { arrow: "down", word: "down", cue: "word" } }))).toEqual(["WORD", "DOWN"]);
    expect(draw({ prompt: { arrow: "down", word: "down", cue: "word" } }).filter((c) => c.name === "roundRect")).toHaveLength(1);
  });

  it("points the arrow by its shape", () => {
    const tip = (dir: ArrowFlipPrompt["arrow"]) => {
      const lines = draw({ prompt: { arrow: dir, word: dir, cue: "word" }, msSincePrompt: SLIDE_MS }).filter((c) => c.name === "lineTo");
      return lines[2].args as [number, number];
    };
    const { cx, cy } = promptLayout(390, 560).arrow;
    const [rx] = tip("right");
    const [lx] = tip("left");
    const [, uy] = tip("up");
    const [, dy] = tip("down");
    expect([rx > cx, lx < cx, uy < cy, dy > cy]).toEqual([true, true, true, true]);
  });

  it("draws the limit bar's fill to the share of time left", () => {
    const bar = draw({ msSincePrompt: 1000 }).filter((c) => c.name === "fillRect" && c.fillStyle === "#l");
    const { w } = promptLayout(390, 560).bar;
    expect(bar[0].args[2]).toBe(w / 2);
  });

  it("shows a tick for a right answer, and a cross with the right direction for a wrong or missed one", () => {
    const right = draw({ feedback: { result: "right", answer: "left" } });
    expect(texts(right)).toEqual(["Right"]);
    expect(right.filter((c) => c.name === "stroke" && c.strokeStyle === "#r")).toHaveLength(1);
    const wrong = draw({ feedback: { result: "wrong", answer: "left" } });
    expect(texts(wrong)).toEqual(["Wrong", "It was LEFT"]);
    expect(wrong.filter((c) => c.name === "stroke" && c.strokeStyle === "#x")).toHaveLength(1);
    expect(texts(draw({ feedback: { result: "timeout", answer: "up" } }))).toEqual(["Too slow", "It was UP"]);
  });

  it("draws only the board with no prompt", () => {
    const calls = draw({ prompt: null });
    expect(calls.map((c) => c.name)).toEqual(["setTransform", "fillRect"]);
  });
});
