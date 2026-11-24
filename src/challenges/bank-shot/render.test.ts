import { describe, expect, it } from "vitest";
import { FREE_UNITS, flight, type BankShotParams, type BankShotRound } from "./engine";
import { BOARD_H, BOARD_W } from "./geometry";
import { FREE_BAND_UNITS, LAYOUT_UNITS, STRIP_UNITS, angleLabel, boardLayout, bumperAngle, drawBankShot, markerX, missLabel, oneDecimal, pathOf, puckAt, toBoard, toCanvas, type BankShotFrame } from "./render";

// The hand-worked T230 shot: off the right wall at (100, 50) at 1 000 ms, crossing at x = 75 at 1 500 ms.
const shot: BankShotRound = { start: { x: 50, y: 150 }, velocity: { x: 0.05, y: -0.1 }, bounces: 1, glimpseMs: 1200 };
const bumped: BankShotRound = { start: { x: 50, y: 150 }, velocity: { x: 0, y: -0.1 }, bounces: 1, glimpseMs: 1200, bumper: { center: { x: 50, y: 75 }, length: 20, omegaPerMs: 0, phase: Math.PI / 3 } };
const params: BankShotParams = { bank: 30, rounds: [shot, bumped] };
const colors = { board: "#b", wall: "#w", line: "#l", strip: "#s", puck: "#p", bumper: "#u", marker: "#m", crossing: "#c", path: "#t", miss: "#x", text: "#e" };

/** A 390 px wide canvas at the board's own aspect: a phone. */
const W = 390;
const H = (W * LAYOUT_UNITS.height) / LAYOUT_UNITS.width;

type Call = { name: string; args: unknown[]; fillStyle?: unknown; strokeStyle?: unknown };
function recorder() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, name: string) => (name in target ? target[name] : (...args: unknown[]) => calls.push({ name, args, fillStyle: target.fillStyle, strokeStyle: target.strokeStyle })),
    set: (target, name: string, value) => ((target[name] = value), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const frame = (over: Partial<BankShotFrame> = {}): BankShotFrame => ({
  width: W,
  height: H,
  devicePixelRatio: 2,
  params,
  round: 0,
  msSinceLaunch: 500,
  marker: null,
  reveal: null,
  missTint: 0,
  reducedMotion: false,
  colors,
  ...over,
});

function draw(over: Partial<BankShotFrame> = {}) {
  const { ctx, calls } = recorder();
  drawBankShot(ctx, frame(over));
  return calls;
}
const texts = (calls: Call[]) => calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);
const arcsIn = (calls: Call[], color: string) => calls.filter((c) => c.name === "arc" && c.fillStyle === color);

describe("Bank Shot layout (T232)", () => {
  const layout = boardLayout(W, H);

  it("fills a phone-width canvas, with a tap strip at least 44 px tall above the finish line", () => {
    expect(layout.scale * LAYOUT_UNITS.width).toBeCloseTo(W, 9);
    expect(STRIP_UNITS * layout.scale).toBeGreaterThanOrEqual(44);
    expect(toCanvas(layout, BOARD_W, BOARD_H).y).toBeLessThanOrEqual(H);
  });

  it("maps board units to canvas px and back at five sizes, and centres a wide canvas", () => {
    for (const [w, h] of [[390, 560], [320, 480], [420, 640], [800, 600], [1000, 1500]]) {
      const l = boardLayout(w, h);
      for (const [x, y] of [[0, 0], [75, 30], [BOARD_W, BOARD_H]]) {
        const p = toCanvas(l, x, y);
        expect(Math.abs(toBoard(l, p.x, p.y).x - x)).toBeLessThan(0.01);
        expect(Math.abs(toBoard(l, p.x, p.y).y - y)).toBeLessThan(0.01);
      }
    }
    const wide = boardLayout(1000, H);
    expect(toCanvas(wide, BOARD_W / 2, 0).x).toBeCloseTo(500, 9);
  });

  it("puts the marker straight above a tap, clamped to the line", () => {
    expect(markerX(layout, toCanvas(layout, 42, 0).x)).toBeCloseTo(42, 9);
    expect(markerX(layout, 0)).toBe(0);
    expect(markerX(layout, W)).toBe(BOARD_W);
    for (let x = 0; x <= BOARD_W; x++) {
      const m = markerX(layout, toCanvas(layout, x, 0).x);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(BOARD_W);
      expect(m).toBeCloseTo(x, 9);
    }
  });
});

describe("Bank Shot path and puck (T232)", () => {
  it("runs the path from launch through each bounce to the crossing", () => {
    const path = pathOf(shot);
    expect(path.map((p) => [p.x, Math.round(p.y * 1e6) / 1e6, Math.round(p.atMs)])).toEqual([
      [50, 150, 0],
      [100, 50, 1000],
      [75, 0, 1500],
    ]);
  });

  it("puts the puck on the path at an elapsed ms, and nowhere outside the glimpse", () => {
    expect(puckAt(params, 0, 0)).toEqual({ x: 50, y: 150 });
    const mid = puckAt(params, 0, 500)!;
    expect(mid.x).toBeCloseTo(75, 9);
    expect(mid.y).toBeCloseTo(100, 9);
    const after = puckAt(params, 0, 1100)!;
    expect(after.x).toBeCloseTo(95, 6);
    expect(after.y).toBeCloseTo(40, 6);
    const end = puckAt(params, 0, 1200)!;
    expect(end.x).toBeCloseTo(90, 6);
    expect(end.y).toBeCloseTo(30, 6);
    expect(puckAt(params, 0, -1)).toBeNull();
    expect(puckAt(params, 0, 1201)).toBeNull();
  });

  it("turns the path at the bumper as well as at the walls", () => {
    const path = pathOf(bumped);
    const trace = flight(bumped);
    expect(path.length).toBeGreaterThanOrEqual(3);
    expect(path[1].y).toBeCloseTo(75, 0);
    expect(path.at(-1)!.x).toBeCloseTo(trace.crossing.x, 9);
  });

  it("turns the bumper by elapsed ms", () => {
    const bar = { center: { x: 50, y: 75 }, length: 20, omegaPerMs: 0.001, phase: 0.5 };
    expect(bumperAngle(bar, 0)).toBe(0.5);
    expect(bumperAngle(bar, 1000)).toBeCloseTo(1.5, 12);
  });

  it("labels the bar's angle and the miss", () => {
    expect(angleLabel(Math.PI / 3)).toBe("60°");
    expect(angleLabel(-Math.PI / 4)).toBe("135°");
    expect(missLabel(2.9, 0)).toBe("On target, no cost");
    expect(missLabel(3.5, 0.5)).toBe("Missed by 3.5, cost 0.5");
    expect(missLabel(4.24, 1.24)).toBe("Missed by 4.2, cost 1.2");
    expect(oneDecimal(27.5)).toBe("27.5");
  });
});

describe("drawBankShot (T232)", () => {
  it("draws an empty board with its walls, the dashed finish line and the strip label", () => {
    const calls = draw({ round: null });
    expect(calls[0]).toMatchObject({ name: "setTransform", args: [2, 0, 0, 2, 0, 0] });
    expect(texts(calls)).toEqual(["FINISH"]);
    expect(calls.filter((c) => c.name === "setLineDash")).toHaveLength(2);
    expect(calls.filter((c) => c.name === "stroke" && c.strokeStyle === "#w")).toHaveLength(2);
    expect(arcsIn(calls, "#p")).toHaveLength(0);
  });

  it("draws the puck with a fading trail during the glimpse, and only the puck with reduced motion", () => {
    expect(arcsIn(draw(), "#p")).toHaveLength(7);
    expect(arcsIn(draw({ reducedMotion: true }), "#p")).toHaveLength(1);
    expect(arcsIn(draw({ msSinceLaunch: 1200 }), "#p").length).toBeGreaterThan(0);
    expect(arcsIn(draw({ msSinceLaunch: 1201 }), "#p")).toHaveLength(0);
  });

  it("draws the marker labelled You once placed", () => {
    const calls = draw({ msSinceLaunch: 1300, marker: 40 });
    expect(texts(calls)).toContain("You");
    expect(calls.some((c) => c.name === "fill" && c.fillStyle === "#m")).toBe(true);
  });

  it("reveals the real path, the crossing labelled Here and the miss with its cost, with a miss tint", () => {
    const calls = draw({ msSinceLaunch: 1300, marker: 78.5, reveal: { crossingX: 75, miss: 3.5, cost: 0.5 }, missTint: 0.4 });
    expect(texts(calls)).toEqual(expect.arrayContaining(["Here", "Missed by 3.5, cost 0.5", "You", "Free zone"]));
    expect(calls.some((c) => c.name === "stroke" && c.strokeStyle === "#t")).toBe(true);
    expect(calls.some((c) => c.name === "fillRect" && c.fillStyle === "#x")).toBe(true);
    expect(arcsIn(calls, "#p")).toHaveLength(0);
    // Only a free-zone guess gets the tick, drawn in the text colour.
    expect(calls.some((c) => c.name === "stroke" && c.strokeStyle === "#e")).toBe(false);
    const timeout = texts(draw({ reveal: { crossingX: 75, miss: null, cost: null } }));
    expect(timeout).toContain("Free zone");
    expect(timeout.some((t) => /Missed|On target/.test(String(t)))).toBe(false);
  });

  it("marks a guess inside the free zone with a tick and a no-cost label (T248)", () => {
    const calls = draw({ msSinceLaunch: 1300, marker: 77.9, reveal: { crossingX: 75, miss: 2.9, cost: 0 }, missTint: 0 });
    expect(texts(calls)).toContain("On target, no cost");
    expect(texts(calls).some((t) => /cost \d/.test(String(t)))).toBe(false);
    expect(calls.some((c) => c.name === "stroke" && c.strokeStyle === "#e")).toBe(true);
  });

  it("draws the free zone as an outlined band FREE_UNITS each side of the crossing, inside the walls, even with reduced motion", () => {
    const layout = boardLayout(390, 560);
    const band = (crossingX: number, reducedMotion = false) => {
      const { ctx, calls } = recorder();
      drawBankShot(ctx, frame({ width: 390, height: 560, reducedMotion, reveal: { crossingX, miss: null, cost: null } }));
      return calls.find((c) => c.name === "strokeRect" && c.strokeStyle === "#c")!.args as number[];
    };
    const [x, y, w, h] = band(75);
    expect(x).toBeCloseTo(toCanvas(layout, 75 - FREE_UNITS, 0).x, 9);
    expect(x + w).toBeCloseTo(toCanvas(layout, 75 + FREE_UNITS, 0).x, 9);
    expect(y).toBeCloseTo(layout.top - (FREE_BAND_UNITS / 2) * layout.scale, 9);
    expect(h).toBeCloseTo(FREE_BAND_UNITS * layout.scale, 9);
    const [nearLeft, , nearLeftW] = band(1.5);
    expect(nearLeft).toBeCloseTo(layout.left, 9);
    expect(nearLeft + nearLeftW).toBeCloseTo(toCanvas(layout, 4.5, 0).x, 9);
    const [nearRight, , nearRightW] = band(BOARD_W - 1);
    expect(nearRight + nearRightW).toBeCloseTo(toCanvas(layout, BOARD_W, 0).x, 9);
    expect(band(75, true)).toEqual([x, y, w, h]);
  });

  it("draws the bumper where it stands, and still with its angle under reduced motion", () => {
    const spinning = { ...bumped, bumper: { ...bumped.bumper!, omegaPerMs: 0.001 } };
    const p = { ...params, rounds: [spinning] };
    const bar = (calls: Call[]) => calls.filter((c) => c.name === "lineTo" && calls[calls.indexOf(c) + 1]?.strokeStyle === "#u");
    const a = bar(draw({ params: p, msSinceLaunch: 0 }));
    const b = bar(draw({ params: p, msSinceLaunch: 400 }));
    expect(a).toHaveLength(1);
    expect(a[0].args).not.toEqual(b[0].args);
    const still = draw({ params: p, reducedMotion: true, msSinceLaunch: 0 });
    expect(bar(still)[0].args).toEqual(bar(draw({ params: p, reducedMotion: true, msSinceLaunch: 900 }))[0].args);
    expect(texts(still).some((t) => /°$/.test(String(t)))).toBe(true);
  });
});
