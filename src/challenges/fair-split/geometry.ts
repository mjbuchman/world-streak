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
