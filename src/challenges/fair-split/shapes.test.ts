import { describe, expect, it } from "vitest";
import { BOX, splitShare, type Point } from "./geometry";
import {
  AREA_SHARE,
  asymmetry,
  BLOB_POINTS,
  BLOB_SHARE,
  FALLBACK_SHAPE,
  MARGIN,
  MIN_ASYMMETRY,
  MIN_RADIUS_RATIO,
  POLYGON_VERTICES,
  SHAPES_PER_RUN,
  shapeFor,
  stylesFor,
} from "./shapes";

const SEEDS = Array.from({ length: 1000 }, (_, seed) => seed);

// The checks below are the test's own, not the generator's: brute force, so they cannot share its mistakes.

/**
 * Whether segments pq and rs cross, each one's ends strictly on opposite sides of the other. The
 * tolerance keeps rounding from making two collinear edges look crossed.
 */
function crosses(p: Point, q: Point, r: Point, s: Point): boolean {
  const turn = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const apart = (one: number, other: number) => one * other < -1e-9;
  return apart(turn(p, q, r), turn(p, q, s)) && apart(turn(r, s, p), turn(r, s, q));
}

/** Whether no two edges of the closed outline cross, other than neighbours at their shared corner. */
function isSimple(polygon: Point[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (crosses(polygon[i], polygon[(i + 1) % n], polygon[j], polygon[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** The shoelace area, worked out here rather than taken from geometry.ts. */
function area(polygon: Point[]): number {
  let twice = 0;
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
}

/** The centroid of the outline's area. */
function centreOf(polygon: Point[]): Point {
  let [twice, x, y] = [0, 0, 0];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const cross = p.x * q.y - q.x * p.y;
    twice += cross;
    x += (p.x + q.x) * cross;
    y += (p.y + q.y) * cross;
  });
  return { x: x / (3 * twice), y: y / (3 * twice) };
}

/** The farthest point from the centroid over the nearest one. */
function radiusRatio(polygon: Point[]): number {
  const c = centreOf(polygon);
  const radii = polygon.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  return Math.max(...radii) / Math.min(...radii);
}

/** The share of the area left of a vertical line halving it, by bisection, or null if none is near half. */
function halvingShare(polygon: Point[]): number | null {
  let [low, high] = [0, BOX];
  // Only the share's change matters: it moves monotonically from one side to the other.
  const share = (x: number) => splitShare(polygon, { x, y: 0 }, { x, y: BOX });
  const atLow = share(low);
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (share(mid) - 0.5 > 0 === atLow - 0.5 > 0) low = mid;
    else high = mid;
  }
  return Math.abs(share(low) - 0.5) <= 0.01 ? share(low) : null;
}

const key = (polygon: Point[]) => JSON.stringify(polygon);

describe("Clean Cut shapes (T221, T222)", () => {
  it("documents the values: 70% blobs, 7 to 12 corners, 120 blob points, a 1.3 radius ratio", () => {
    expect([BLOB_SHARE, POLYGON_VERTICES.min, POLYGON_VERTICES.max, BLOB_POINTS, MIN_RADIUS_RATIO, SHAPES_PER_RUN]).toEqual([0.7, 7, 12, 120, 1.3, 5]);
  });

  it("draws blobs for about 70% of 5 000 shapes, and polygons for the rest", () => {
    const styles = SEEDS.flatMap((seed) => stylesFor(seed));
    const blobs = styles.filter((style) => style === "blob").length / styles.length;
    expect(blobs).toBeGreaterThanOrEqual(0.68);
    expect(blobs).toBeLessThanOrEqual(0.72);
    expect(new Set(styles)).toEqual(new Set(["blob", "polygon"]));
  });

  it("gives blobs 120 points and polygons 7 to 12 corners", () => {
    const counts = new Set<number>();
    for (const seed of SEEDS.slice(0, 200)) {
      stylesFor(seed).forEach((style, index) => {
        const points = shapeFor(seed, index).length;
        if (style === "blob") expect(points).toBe(BLOB_POINTS);
        else counts.add(points);
      });
    }
    expect([...counts].sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11, 12]);
  }, 60_000);

  it("gives simple, lopsided, far-from-round outlines inside the margin, of 25% to 70% of the box, over seeds 0 to 999", () => {
    // Collected, not asserted one by one: 5 000 outlines of up to 120 points.
    const broken: string[] = [];
    let [smallest, largest, leastLopsided, leastRatio] = [Infinity, 0, Infinity, Infinity];
    for (const seed of SEEDS) {
      for (let index = 0; index < SHAPES_PER_RUN; index++) {
        const polygon = shapeFor(seed, index);
        const where = `seed ${seed}, shape ${index} (${stylesFor(seed)[index]})`;
        if (polygon.length > 160) broken.push(`${where}: ${polygon.length} points`);
        if (polygon.some(({ x, y }) => Math.min(x, y) < MARGIN - 1e-9 || Math.max(x, y) > BOX - MARGIN + 1e-9)) broken.push(`${where}: outside the margin`);
        if (!isSimple(polygon)) broken.push(`${where}: edges cross`);
        if (halvingShare(polygon) === null) broken.push(`${where}: no halving line`);
        const share = area(polygon) / (BOX * BOX);
        [smallest, largest] = [Math.min(smallest, share), Math.max(largest, share)];
        leastLopsided = Math.min(leastLopsided, asymmetry(polygon));
        leastRatio = Math.min(leastRatio, radiusRatio(polygon));
      }
    }
    expect(broken).toEqual([]);
    expect(smallest).toBeGreaterThanOrEqual(0.25);
    expect(largest).toBeLessThanOrEqual(0.7);
    expect(largest).toBeLessThanOrEqual(AREA_SHARE.max + 1e-9);
    expect(leastLopsided).toBeGreaterThanOrEqual(MIN_ASYMMETRY);
    expect(leastRatio).toBeGreaterThanOrEqual(MIN_RADIUS_RATIO);
  }, 120_000);

  it("is deterministic", () => {
    for (const seed of [0, 7, 123_456, 0xffff_ffff]) {
      for (let index = 0; index < SHAPES_PER_RUN; index++) expect(shapeFor(seed, index)).toEqual(shapeFor(seed, index));
      expect(stylesFor(seed)).toEqual(stylesFor(seed));
    }
  });

  it("makes at least 99% of 1 000 first shapes distinct, and the five shapes of every run differ", () => {
    expect(new Set(SEEDS.map((seed) => key(shapeFor(seed, 0)))).size).toBeGreaterThanOrEqual(990);
    for (const seed of SEEDS.slice(0, 200)) {
      const run = Array.from({ length: SHAPES_PER_RUN }, (_, index) => key(shapeFor(seed, index)));
      expect(new Set(run).size, `seed ${seed}`).toBe(SHAPES_PER_RUN);
    }
  }, 60_000);

  it("falls back to a fixed shape that passes every check when no draw does (T215)", () => {
    const fallback = shapeFor(42, 0, 0);
    expect(fallback).toEqual(FALLBACK_SHAPE);
    expect(isSimple(fallback)).toBe(true);
    expect(fallback.every(({ x, y }) => Math.min(x, y) >= MARGIN - 1e-9 && Math.max(x, y) <= BOX - MARGIN + 1e-9)).toBe(true);
    expect(area(fallback) / (BOX * BOX)).toBeGreaterThanOrEqual(0.27);
    expect(asymmetry(fallback)).toBeGreaterThanOrEqual(MIN_ASYMMETRY);
    expect(radiusRatio(fallback)).toBeGreaterThanOrEqual(MIN_RADIUS_RATIO);
    expect(halvingShare(fallback)).not.toBeNull();
  });

  describe("asymmetry (T210)", () => {
    const polar = (radius: (angle: number) => number, points = 160): Point[] =>
      Array.from({ length: points }, (_, i) => {
        const angle = (2 * Math.PI * i) / points;
        return { x: 50 + radius(angle) * Math.cos(angle), y: 50 + radius(angle) * Math.sin(angle) };
      });
    const square = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ];
    const circle = polar(() => 30);
    const star = polar((angle) => (Math.round((angle * 10) / (2 * Math.PI)) % 2 === 0 ? 35 : 15), 10);
    // A heart (its cleft at angle 0.3 rad), its radius even about that angle: mirrored about it.
    const heart = polar((angle) => 20 + 12 * Math.abs(Math.sin((angle - 0.3) / 2)));
    const turned = (polygon: Point[], degrees: number) => {
      const [c, s] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
      return polygon.map(({ x, y }) => ({ x: 50 + (x - 50) * c - (y - 50) * s, y: 50 + (x - 50) * s + (y - 50) * c }));
    };
    // Three skewed lobes: the same after a third of a turn, but with no mirror axis.
    const pinwheel = (lean = 0) => polar((angle) => 25 + 6 * Math.cos(3 * angle) + 4 * Math.sin(6 * angle) + lean * Math.cos(angle));

    it.each([
      ["a square", square],
      ["a square turned 17.5 degrees, its axes off the 1-degree grid", turned(square, 17.5)],
      ["a circle", circle],
      ["a regular five-point star", star],
      ["a regular five-point star turned 17.5 degrees", turned(star, 17.5)],
      ["a symmetric heart", heart],
      ["a three-fold pinwheel, by its turns alone", pinwheel()],
    ])("measures %s as symmetric", (_name, polygon) => {
      expect(asymmetry(polygon)).toBeLessThan(MIN_ASYMMETRY);
    });

    it("finds the pinwheel lopsided once a lean breaks its turn: no mirror made it pass", () => {
      expect(asymmetry(pinwheel(5))).toBeGreaterThanOrEqual(MIN_ASYMMETRY);
    });

    it("measures a lopsided blob as lopsided, wherever it sits", () => {
      const blob = polar((angle) => 25 + 8 * Math.cos(angle) + 7 * Math.cos(2 * angle + 1) + 5 * Math.cos(3 * angle + 2));
      expect(asymmetry(blob)).toBeGreaterThanOrEqual(MIN_ASYMMETRY);
      expect(asymmetry(blob.map(({ x, y }) => ({ x: x + 7, y: y - 4 })))).toBeCloseTo(asymmetry(blob), 6);
    });
  });

  it("rejects an outline with crossing edges in the test's own check", () => {
    const bowTie = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(isSimple(bowTie)).toBe(false);
    expect(
      isSimple([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ).toBe(true);
  });
});
