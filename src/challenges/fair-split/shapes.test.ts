import { describe, expect, it } from "vitest";
import { createRng } from "../shared/prng";
import { BOX, polygonArea, splitShare, type Point } from "./geometry";
import { AREA_SHARE, CURVED_SHARE, KINDS_PER_RUN, kindsFor, MARGIN, SHAPE_KINDS, shapeFor } from "./shapes";

const SEEDS = Array.from({ length: 1000 }, (_, seed) => seed);

/**
 * Whether segments pq and rs cross, each one's ends strictly on opposite sides of the other. The
 * tolerance keeps rounding from making two collinear edges (a turned cross's arms) look crossed.
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

/** The x of a vertical line halving the area, by bisection, or null if the share never reaches half. */
function halvingX(polygon: Point[]): number | null {
  let [low, high] = [0, BOX];
  // The share on the left of a line going down (a at the top) is the part with smaller x... or larger;
  // only the share's change matters: it moves monotonically from one side to the other.
  const share = (x: number) => splitShare(polygon, { x, y: 0 }, { x, y: BOX });
  const atLow = share(low);
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (share(mid) - 0.5 > 0 === atLow - 0.5 > 0) low = mid;
    else high = mid;
  }
  return Math.abs(share(low) - 0.5) < 1e-6 ? low : null;
}

describe("Fair Split shapes (T192)", () => {
  it("has the curved and angular kinds the owner asked for", () => {
    expect(SHAPE_KINDS.filter((kind) => kind.curved).map((kind) => kind.name)).toEqual([
      "blob",
      "flower",
      "cloud",
      "heart",
      "teardrop",
      "kidney bean",
      "swoosh",
      "thick C",
      "crescent",
    ]);
    expect(SHAPE_KINDS.filter((kind) => !kind.curved).map((kind) => kind.name)).toEqual(["arrow", "star", "cross", "zig-zag"]);
    expect(CURVED_SHARE).toBe(0.75);
  });

  it("samples every curved kind at 64 to 160 points, and no kind above 160", () => {
    for (const kind of SHAPE_KINDS) {
      for (const seed of [0, 1, 2]) {
        const points = kind.build(createRng(seed)).length;
        expect(points, kind.name).toBeLessThanOrEqual(160);
        if (kind.curved) expect(points, kind.name).toBeGreaterThanOrEqual(64);
      }
    }
  });

  it("gives simple outlines inside the margin, of 25% to 70% of the box, over seeds 0 to 999", () => {
    // Collected, not asserted one by one: 5 000 outlines of up to 160 points.
    const broken: string[] = [];
    let smallest = Infinity;
    let largest = 0;
    for (const seed of SEEDS) {
      for (let index = 0; index < KINDS_PER_RUN; index++) {
        const polygon = shapeFor(seed, index);
        const where = `seed ${seed}, shape ${index} (${kindsFor(seed)[index].name})`;
        if (polygon.length > 160) broken.push(`${where}: ${polygon.length} points`);
        if (polygon.some(({ x, y }) => Math.min(x, y) < MARGIN - 1e-9 || Math.max(x, y) > BOX - MARGIN + 1e-9)) broken.push(`${where}: outside the margin`);
        if (!isSimple(polygon)) broken.push(`${where}: edges cross`);
        const share = polygonArea(polygon) / (BOX * BOX);
        smallest = Math.min(smallest, share);
        largest = Math.max(largest, share);
      }
    }
    expect(broken).toEqual([]);
    expect(smallest).toBeGreaterThanOrEqual(0.25);
    expect(largest).toBeLessThanOrEqual(0.7);
    expect(largest).toBeLessThanOrEqual(AREA_SHARE.max + 1e-9);
  }, 60_000);

  it("gives every kind an outline a straight line can halve", () => {
    for (const kind of SHAPE_KINDS) {
      // The first seed whose run draws this kind.
      const seed = SEEDS.find((s) => kindsFor(s).includes(kind));
      expect(seed, kind.name).toBeDefined();
      const polygon = shapeFor(seed!, kindsFor(seed!).indexOf(kind));
      expect(isSimple(polygon), kind.name).toBe(true);
      expect(halvingX(polygon), kind.name).not.toBeNull();
    }
  });

  it("is deterministic", () => {
    for (const seed of [0, 7, 123_456, 0xffff_ffff]) {
      for (let index = 0; index < KINDS_PER_RUN; index++) expect(shapeFor(seed, index)).toEqual(shapeFor(seed, index));
      expect(kindsFor(seed)).toEqual(kindsFor(seed));
    }
  });

  it("never repeats a kind within a run, and draws every kind somewhere", () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const names = kindsFor(seed).map((kind) => kind.name);
      expect(new Set(names).size, `seed ${seed}`).toBe(KINDS_PER_RUN);
      names.forEach((name) => seen.add(name));
    }
    expect(seen.size).toBe(SHAPE_KINDS.length);
  });

  it("makes at least 70% of 5 000 drawn shapes curved", () => {
    const curved = SEEDS.flatMap((seed) => kindsFor(seed)).filter((kind) => kind.curved).length;
    expect(curved / (SEEDS.length * KINDS_PER_RUN)).toBeGreaterThanOrEqual(0.7);
  });

  it("makes the same kind look different from run to run", () => {
    const hearts = SEEDS.filter((seed) => kindsFor(seed)[0].name === "heart").slice(0, 20);
    const outlines = new Set(hearts.map((seed) => JSON.stringify(shapeFor(seed, 0))));
    expect(hearts.length).toBeGreaterThan(5);
    expect(outlines.size).toBe(hearts.length);
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
