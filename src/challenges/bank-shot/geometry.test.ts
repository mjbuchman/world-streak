import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { BOARD_W, barHit, crossingTime, reflect, rotatingBar, traceStraight, traceWithBar, unfoldedX, type RotatingBar, type Vec } from "./geometry";

const speed = (v: Vec) => Math.hypot(v.x, v.y);

/** A brute-force 1 ms stepping trace, independent of the closed form: wall bounces and crossing x. */
function stepped(start: Vec, velocity: Vec) {
  let { x, y } = start;
  let vx = velocity.x;
  let bounces = 0;
  for (;;) {
    const nx = x + vx;
    const ny = y + velocity.y;
    if (ny <= 0) return { bounces, x: x + (y / (y - ny)) * (nx - x) };
    x = nx;
    y = ny;
    if (x < 0 || x > BOARD_W) {
      x = x < 0 ? -x : 2 * BOARD_W - x;
      vx = -vx;
      bounces++;
    }
  }
}

describe("Bank Shot geometry: exact shots (T230)", () => {
  it("reflects off vertical and horizontal surfaces exactly", () => {
    expect(reflect({ x: 1, y: -1 }, { x: 1, y: 0 })).toEqual({ x: -1, y: -1 });
    expect(reflect({ x: 1, y: -1 }, { x: 0, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(reflect({ x: 1, y: -1 }, { x: -3, y: 0 })).toEqual({ x: -1, y: -1 });
  });

  it("crosses at x = 80 at 1 500 ms with no bounce", () => {
    const { hits, crossing } = traceStraight({ x: 50, y: 150 }, { x: 0.02, y: -0.1 });
    expect(hits).toEqual([]);
    expect(crossing.x).toBeCloseTo(80, 9);
    expect(crossing.atMs).toBeCloseTo(1500, 9);
  });

  it("hits the right wall at (100, 50) at 1 000 ms and crosses at x = 75", () => {
    const { hits, crossing } = traceStraight({ x: 50, y: 150 }, { x: 0.05, y: -0.1 });
    expect(hits).toHaveLength(1);
    expect(hits[0].x).toBe(100);
    expect(hits[0].y).toBeCloseTo(50, 9);
    expect(hits[0].atMs).toBeCloseTo(1000, 9);
    expect(crossing.x).toBeCloseTo(75, 9);
    expect(crossing.atMs).toBeCloseTo(1500, 9);
  });

  it("hits the left wall, then the right, and crosses at x = 70", () => {
    const { hits, crossing } = traceStraight({ x: 20, y: 150 }, { x: -0.1, y: -0.1 });
    expect(hits.map((h) => h.x)).toEqual([0, 100]);
    expect(hits[0].y).toBeCloseTo(130, 9);
    expect(hits[0].atMs).toBeCloseTo(200, 9);
    expect(hits[1].y).toBeCloseTo(30, 9);
    expect(hits[1].atMs).toBeCloseTo(1200, 9);
    expect(crossing.x).toBeCloseTo(70, 9);
  });

  it("keeps the speed through every bounce", () => {
    let v = { x: -0.1, y: -0.07 };
    const before = speed(v);
    for (let i = 0; i < 6; i++) v = reflect(v, i % 2 ? { x: 1, y: 0 } : { x: 0, y: 1 });
    expect(Math.abs(speed(v) - before)).toBeLessThan(1e-9);
  });

  it("counts a shot into a top corner as crossing at that wall, with no bounce", () => {
    for (const vx of [0.05, -0.05]) {
      const { hits, crossing } = traceStraight({ x: 50, y: 150 }, { x: vx, y: -0.15 });
      expect(hits).toEqual([]);
      expect(crossing.x).toBeCloseTo(vx > 0 ? 100 : 0, 6);
    }
  });

  it("refuses a start on a wall or a puck that is not moving up", () => {
    expect(() => traceStraight({ x: 0, y: 150 }, { x: 0.1, y: -0.1 })).toThrow(RangeError);
    expect(() => traceStraight({ x: 100, y: 150 }, { x: -0.1, y: -0.1 })).toThrow(RangeError);
    expect(() => crossingTime(150, 0)).toThrow(RangeError);
    expect(() => crossingTime(0, -0.1)).toThrow(RangeError);
  });

  it("unfolds x between the walls without stepping", () => {
    expect(unfoldedX(20, -0.1, 1500, 100)).toBeCloseTo(70, 9);
    expect(unfoldedX(50, 0.05, 1500, 100)).toBeCloseTo(75, 9);
    expect(unfoldedX(50, 0, 1500, 100)).toBe(50);
  });
});

describe("Bank Shot geometry: properties over seeds 0 to 999 (T230)", () => {
  const shots = Array.from({ length: 1000 }, (_, seed) => {
    const rng = createRng(seed);
    const start = { x: 5 + rng.next() * 90, y: 150 };
    const velocity = { x: (rng.next() * 2 - 1) * 0.25, y: -(0.04 + rng.next() * 0.1) };
    return { start, velocity, trace: traceStraight(start, velocity) };
  });
  // A bounce within 2 ms of the crossing is where 1 ms stepping itself becomes ambiguous.
  const clean = shots.filter(({ trace }) => trace.hits.every((h) => trace.crossing.atMs - h.atMs > 2));

  it("agrees with brute-force stepping on the crossing x and the bounce count", () => {
    expect(clean.length).toBeGreaterThan(990);
    for (const { start, velocity, trace } of clean) {
      const brute = stepped(start, velocity);
      expect(Math.abs(brute.x - trace.crossing.x)).toBeLessThan(0.2);
      expect(trace.hits).toHaveLength(brute.bounces);
    }
  });

  it("always crosses inside the board, after every bounce, with bounces on the walls", () => {
    for (const { trace } of shots) {
      expect(trace.crossing.x).toBeGreaterThanOrEqual(0);
      expect(trace.crossing.x).toBeLessThanOrEqual(BOARD_W);
      for (const h of trace.hits) {
        expect([0, BOARD_W]).toContain(h.x);
        expect(h.atMs).toBeLessThan(trace.crossing.atMs);
      }
    }
  });
});

describe("Bank Shot geometry: the spinning bumper (T230)", () => {
  const flat: RotatingBar = { center: { x: 50, y: 50 }, length: 20, omegaPerMs: 0, phase: 0 };

  it("places the bar's endpoints at a given elapsed ms", () => {
    expect(rotatingBar({ x: 50, y: 50 }, 20, 0.001, 0, 0)).toEqual({ a: { x: 40, y: 50 }, b: { x: 60, y: 50 } });
    const { a, b } = rotatingBar({ x: 50, y: 50 }, 20, 0.001, 0, (Math.PI / 2) * 1000);
    expect(a.x).toBeCloseTo(50, 9);
    expect(a.y).toBeCloseTo(40, 9);
    expect(b.y).toBeCloseTo(60, 9);
  });

  it("reflects a head-on hit straight back", () => {
    const hit = barHit({ x: 50, y: 50.5 }, { x: 50, y: 49.5 }, flat, 0);
    expect(hit?.point).toEqual({ x: 50, y: 50 });
    expect(hit?.velocity.x).toBeCloseTo(0, 12);
    expect(hit?.velocity.y).toBeCloseTo(1, 12);
  });

  it("hits a spinning bar only where it stands at the given ms", () => {
    const spinning = { ...flat, omegaPerMs: Math.PI / 2 / 1000 };
    expect(barHit({ x: 49.5, y: 50 }, { x: 50.5, y: 50 }, spinning, 0)).toBeNull();
    const hit = barHit({ x: 49.5, y: 50 }, { x: 50.5, y: 50 }, spinning, 1000);
    expect(hit?.point.x).toBeCloseTo(50, 9);
    expect(hit?.velocity.x).toBeCloseTo(-1, 9);
    expect(hit?.velocity.y).toBeCloseTo(0, 9);
  });

  it("reflects off a bar at 45 degrees exactly", () => {
    const hit = barHit({ x: 50, y: 50.5 }, { x: 50, y: 49.5 }, { ...flat, phase: Math.PI / 4 }, 0);
    expect(hit?.velocity.x).toBeCloseTo(-1, 12);
    expect(hit?.velocity.y).toBeCloseTo(0, 12);
  });

  it("hits the bar's end and a move ending on it, misses past it, and ignores parallel moves", () => {
    expect(barHit({ x: 60, y: 50.5 }, { x: 60, y: 49.5 }, flat, 0)?.point).toEqual({ x: 60, y: 50 });
    expect(barHit({ x: 50, y: 51 }, { x: 50, y: 50 }, flat, 0)?.point).toEqual({ x: 50, y: 50 });
    expect(barHit({ x: 70, y: 50.5 }, { x: 70, y: 49.5 }, flat, 0)).toBeNull();
    expect(barHit({ x: 30, y: 50 }, { x: 35, y: 50 }, flat, 0)).toBeNull();
    expect(barHit({ x: 50, y: 52 }, { x: 50, y: 51 }, flat, 0)).toBeNull();
  });

  it("matches the straight trace when the bar is out of the way", () => {
    const away = { ...flat, center: { x: 50, y: -500 } };
    const start = { x: 20, y: 150 };
    const velocity = { x: -0.1, y: -0.1 };
    const stepTrace = traceWithBar(start, velocity, away, 10_000);
    const exact = traceStraight(start, velocity);
    expect(stepTrace?.barHits).toEqual([]);
    expect(stepTrace?.hits).toHaveLength(2);
    expect(Math.abs((stepTrace?.crossing.x ?? -1) - exact.crossing.x)).toBeLessThan(0.2);
  });

  it("turns a shot straight up off a bar at 60 degrees, then bounces it off the left wall", () => {
    // Off a bar at angle t, a puck moving straight up leaves along (-sin 2t, cos 2t): (-0.866, -0.5) at 60 degrees.
    // From (50, 75) at speed 0.1 it needs 1 500 ms to the line, moving 129.9 left: 50 to the wall, 79.9 back.
    const trace = traceWithBar({ x: 50, y: 150 }, { x: 0, y: -0.1 }, { center: { x: 50, y: 75 }, length: 20, omegaPerMs: 0, phase: Math.PI / 3 }, 10_000);
    expect(trace?.barHits).toHaveLength(1);
    expect(trace?.hits.map((h) => h.x)).toEqual([0]);
    expect(Math.abs((trace?.crossing.x ?? -1) - 79.904)).toBeLessThan(0.3);
    expect(Math.abs((trace?.crossing.atMs ?? -1) - 2250)).toBeLessThan(2);
  });

  it("reflects off the bottom edge and gives up when the puck never crosses", () => {
    const down = traceWithBar({ x: 50, y: 150 }, { x: 0, y: -0.1 }, { center: { x: 50, y: 140 }, length: 20, omegaPerMs: 0, phase: Math.PI / 6 }, 20_000);
    expect(down?.barHits.length).toBeGreaterThanOrEqual(1);
    expect(down?.crossing.atMs).toBeGreaterThan(1500);
    expect(traceWithBar({ x: 50, y: 150 }, { x: 0, y: -0.1 }, { ...flat, center: { x: 50, y: 75 } }, 5000)).toBeNull();
  });
});
