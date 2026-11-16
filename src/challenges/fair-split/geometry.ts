import { createRng } from "../shared/prng";

/** Fair Split's shapes live in a 100 x 100 box (shape units); the canvas scales them. */
export type Point = { x: number; y: number };
export type Polygon = readonly Point[];

export const BOX = 100;

/** Twice the signed area (positive for one winding, negative for the other). */
function signedArea2(polygon: Polygon): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** The shoelace area. */
export const polygonArea = (polygon: Polygon) => Math.abs(signedArea2(polygon)) / 2;

/** Positive on the left of the line from `a` through `b`, negative on the right, 0 on it. */
const side = (a: Point, b: Point, p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/**
 * The part of the polygon on the left of the infinite line through `a` and `b` (one half-plane
 * clip). For a concave polygon cut into several pieces the result is one outline joining them
 * along the line; the joins enclose no area, so its signed area is the pieces' total.
 */
export function clipLeft(polygon: Polygon, a: Point, b: Point): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const sp = side(a, b, p);
    const sq = side(a, b, q);
    if (sp > 0) out.push(p);
    if (sp > 0 !== sq > 0 && sp !== sq) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
    }
  }
  return out;
}

/** The share (0 to 1) of the polygon's area on the left of the line through `a` and `b`; 0 when `a` is `b`. */
export function splitShare(polygon: Polygon, a: Point, b: Point): number {
  const whole = signedArea2(polygon);
  return whole === 0 ? 0 : Math.abs(signedArea2(clipLeft(polygon, a, b)) / whole);
}

/** Corner pairs per shape (inclusive), the outer radius, and how far a dent goes in at oddness 1 (share of the radius). */
const CORNER_PAIRS = { min: 4, max: 6 } as const;
const RADIUS = 48;
const DENT = { min: 0.42, max: 0.5 } as const;
/** How far each corner's angle may stray from even spacing, as a share of the spacing. */
const ANGLE_JITTER = 0.15;

/**
 * Shape `index` of a run: corners at rising angles around the box's centre, so the outline never
 * crosses itself. At oddness 0 every corner sits on one circle (convex); with more oddness every
 * other corner is pulled in (concave). At oddness 1 a dent sits inside the line joining its
 * neighbours even with 4 pairs and the widest spacing (cos 51.75° = 0.62 of the radius > 0.58).
 */
export function shapeFor(seed: number, index: number, oddness: number): Point[] {
  const rng = createRng((seed ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0);
  const corners = 2 * rng.int(CORNER_PAIRS.min, CORNER_PAIRS.max);
  const turn = rng.next() * 2 * Math.PI;
  const step = (2 * Math.PI) / corners;
  return Array.from({ length: corners }, (_, i) => {
    const angle = turn + (i + (rng.next() * 2 - 1) * ANGLE_JITTER) * step;
    const pull = i % 2 === 1 ? DENT.min + (DENT.max - DENT.min) * rng.next() : 0;
    const radius = RADIUS * (1 - oddness * pull);
    return { x: BOX / 2 + radius * Math.cos(angle), y: BOX / 2 + radius * Math.sin(angle) };
  });
}
