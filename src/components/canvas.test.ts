// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fitCanvas, readColorTokens } from "./canvas";

function canvasOfSize(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ width, height }) as DOMRect;
  return canvas;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fitCanvas", () => {
  it("sizes the backing store to the CSS box times the device pixel ratio", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const canvas = canvasOfSize(140.4, 300);
    expect(fitCanvas(canvas)).toEqual({ width: 140.4, height: 300, devicePixelRatio: 2 });
    expect([canvas.width, canvas.height]).toEqual([281, 600]);
  });

  it("falls back to a ratio of 1", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    const canvas = canvasOfSize(100, 50);
    expect(fitCanvas(canvas).devicePixelRatio).toBe(1);
    expect([canvas.width, canvas.height]).toEqual([100, 50]);
  });

  it("leaves the backing store alone when the size has not changed", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const canvas = canvasOfSize(100, 50);
    fitCanvas(canvas);
    const width = vi.spyOn(canvas, "width", "set");
    const height = vi.spyOn(canvas, "height", "set");
    fitCanvas(canvas);
    expect(width).not.toHaveBeenCalled();
    expect(height).not.toHaveBeenCalled();
  });
});

describe("readColorTokens", () => {
  it("reads each token off the element, trimmed", () => {
    const element = document.createElement("div");
    // jsdom does not compute custom properties, so stand in for the browser.
    const values: Record<string, string> = { "--a": " #fff ", "--b": "rgb(1, 2, 3)\n" };
    const read = vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: (name: string) => values[name] } as CSSStyleDeclaration);
    expect(readColorTokens(element, { first: "--a", second: "--b" })).toEqual({ first: "#fff", second: "rgb(1, 2, 3)" });
    expect(read).toHaveBeenCalledWith(element);
  });
});
