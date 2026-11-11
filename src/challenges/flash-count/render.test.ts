import { describe, expect, it, vi } from "vitest";
import { BOARD_PADDING, dotsVisible, drawFlashCount, type FlashCountFrame } from "./render";

function fakeContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
  };
}

const frame = (over: Partial<FlashCountFrame> = {}): FlashCountFrame => ({
  dots: [
    { x: 0.5, y: 0.5, r: 0.02 },
    { x: 0.1, y: 0.9, r: 0.025 },
  ],
  showDots: true,
  width: 300,
  height: 200,
  devicePixelRatio: 2,
  colors: { board: "#052E30", dot: "#34F5B5" },
  ...over,
});

describe("dotsVisible", () => {
  it("shows the dots for exactly flashMs of elapsed time", () => {
    expect(dotsVisible(0, 1000)).toBe(true);
    expect(dotsVisible(999.9, 1000)).toBe(true);
    expect(dotsVisible(1000, 1000)).toBe(false);
  });
});

describe("drawFlashCount", () => {
  it("draws a centred square board and every dot scaled into its padded field, for the device's pixel ratio", () => {
    const ctx = fakeContext();
    drawFlashCount(ctx as unknown as CanvasRenderingContext2D, frame());
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 200);
    // A 200 x 200 board, 50 px in from the left; the dots' field is 176 px, 12 px inside it.
    expect(BOARD_PADDING).toBe(0.06);
    expect(ctx.fillRect).toHaveBeenCalledWith(50, 0, 200, 200);
    const calls = ctx.arc.mock.calls.map((call) => call.map((n: number) => Math.round(n * 1000) / 1000));
    expect(calls).toEqual([
      [150, 100, 3.52, 0, 6.283],
      [79.6, 170.4, 4.4, 0, 6.283],
    ]);
    expect(ctx.fill).toHaveBeenCalledTimes(2);
    expect(ctx.fillStyle).toBe("#34F5B5");
  });

  it("draws only the empty board once the flash is over", () => {
    const ctx = fakeContext();
    drawFlashCount(ctx as unknown as CanvasRenderingContext2D, frame({ showDots: false }));
    expect(ctx.fillRect).toHaveBeenCalledOnce();
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
