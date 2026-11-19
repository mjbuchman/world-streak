import { createRng, type Rng } from "../shared/prng";
import { BOX, polygonArea, type Point } from "./geometry";

/**
 * Fair Split's shapes (T221): irregular blobs and irregular polygons, never an identifiable shape
 * (the owner's M7 play-test). Both are star-shaped around the origin (one radius per angle, always
 * positive), so every outline is simple by construction. Each is then mirrored, turned, sized and
 * centred in the box from the same seeded RNG.
 */

export type ShapeStyle = "blob" | "polygon";

/** The share of a run's shapes that are blobs; the rest are polygons (T221; owner to confirm). */
export const BLOB_SHARE = 0.7;
/** Shapes in one run. */
export const SHAPES_PER_RUN = 5;
/** The space kept clear inside the box, in shape units. */
export const MARGIN = 3;
/** A shape's area is drawn from this range, as a share of the box, then shrunk if it would not fit. */
export const AREA_SHARE = { min: 0.34, max: 0.5 } as const;
/** Points along a blob's outline. */
export const BLOB_POINTS = 120;
/** A blob is the sum of this many waves round a circle. */
export const BLOB_HARMONICS = { min: 3, max: 5 } as const;
/** A polygon's corner count. */
export const POLYGON_VERTICES = { min: 7, max: 12 } as const;
/**
 * The farthest point of a kept shape from its centroid is at least this many times the nearest (both
 * over its points), so no shape comes out near a circle or a regular polygon.
 */
export const MIN_RADIUS_RATIO = 1.3;

const TAU = 2 * Math.PI;
const between = (rng: Rng, min: number, max: number) => min + (max - min) * rng.next();

/** A curve with one radius per angle: always simple when the radius stays positive. */
const polar = (points: number, radius: (angle: number) => number): Point[] =>
  Array.from({ length: points }, (_, i) => {
    const angle = (TAU * i) / points;
    const r = radius(angle);
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });

/** The largest the waves of a blob may add up to: its radius never drops below 1 minus this. */
const BLOB_MAX_SWING = 0.6;

/** A circle bent by 3 to 5 waves of distinct frequencies (1 to 6 a turn), sizes and phases. */
function blob(rng: Rng): Point[] {
  const frequencies = [1, 2, 3, 4, 5, 6];
  const waves = Array.from({ length: rng.int(BLOB_HARMONICS.min, BLOB_HARMONICS.max) }, () => {
    const k = frequencies.splice(rng.int(0, frequencies.length - 1), 1)[0];
    return { k, size: between(rng, 0.06, 0.24), phase: between(rng, 0, TAU) };
  });
  const swing = waves.reduce((sum, wave) => sum + wave.size, 0);
  const shrink = Math.min(1, BLOB_MAX_SWING / swing);
  return polar(BLOB_POINTS, (a) => 1 + shrink * waves.reduce((sum, { k, size, phase }) => sum + size * Math.cos(k * a + phase), 0));
}

/**
 * Corners at rising angles, each jittered inside its own slice of the turn, at random radii. Two
 * neighbouring corners are less than two slices (under half a turn) apart, so the origin is inside
 * and every ray from it crosses the outline once.
 */
function polygon(rng: Rng): Point[] {
  const corners = rng.int(POLYGON_VERTICES.min, POLYGON_VERTICES.max);
  const slice = TAU / corners;
  return Array.from({ length: corners }, (_, i) => {
    const angle = slice * (i + between(rng, 0.1, 0.9));
    const r = between(rng, 0.45, 1);
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });
}

/** Mixes a seed and an index into one 32-bit seed, so neighbouring indices differ. */
const mix = (seed: number, index: number) => (seed ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0;

/** A run's styles: each shape is a blob with chance BLOB_SHARE, a polygon otherwise. */
export function stylesFor(seed: number): ShapeStyle[] {
  const rng = createRng(mix(seed, SHAPES_PER_RUN));
  return Array.from({ length: SHAPES_PER_RUN }, () => (rng.next() < BLOB_SHARE ? "blob" : "polygon"));
}

const bounds = (points: Point[]) => ({
  minX: Math.min(...points.map((p) => p.x)),
  maxX: Math.max(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)),
  maxY: Math.max(...points.map((p) => p.y)),
});

/** A long shape turned corner to corner fits the box only small; a fitted share below this tries another turn. */
const MIN_FITTED_SHARE = 0.3;
/** Turns tried before keeping the one that fits biggest. */
const TURN_TRIES = 4;

/** The outline mirrored (maybe), turned and sized, centred in the box inside the margin. */
function fitted(outline: Point[], flip: number, turn: number, wantedShare: number): Point[] {
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  const turned = outline.map(({ x, y }) => ({ x: flip * x * cos - y * sin, y: flip * x * sin + y * cos }));
  const box = bounds(turned);
  const wanted = Math.sqrt((wantedShare * BOX * BOX) / polygonArea(turned));
  const fits = (BOX - 2 * MARGIN) / Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const scale = Math.min(wanted, fits);
  const centre = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  return turned.map((p) => ({ x: BOX / 2 + (p.x - centre.x) * scale, y: BOX / 2 + (p.y - centre.y) * scale }));
}

/** Places the outline at a seeded turn, trying a few turns when a long shape would come out small. */
function place(outline: Point[], rng: Rng): Point[] {
  const flip = rng.next() < 0.5 ? -1 : 1;
  const wantedShare = between(rng, AREA_SHARE.min, AREA_SHARE.max);
  const share = (polygon: Point[]) => polygonArea(polygon) / (BOX * BOX);
  let best: Point[] | null = null;
  for (let i = 0; i < TURN_TRIES; i++) {
    const candidate = fitted(outline, flip, between(rng, 0, TAU), wantedShare);
    if (share(candidate) >= MIN_FITTED_SHARE) return candidate;
    if (!best || share(candidate) > share(best)) best = candidate;
  }
  return best!;
}

/**
 * A finished shape must be at least this far from every mirror image and every 2 to 5-fold turn of
 * itself, as a share of its area (T210, T222; proposed, owner to confirm). Raised from 0.04 (T222):
 * the symmetric references in the tests measure at most 0.001; at a 0.04 floor the least lopsided
 * kept shape over seeds 0 to 999 measured 0.040, so the floor binds. At 0.08, 88.5% of shapes pass
 * at the first draw and none needs the fallback.
 */
export const MIN_ASYMMETRY = 0.08;
/**
 * One ray every 2 degrees from the centroid. Mirror axes 1 degree apart still map ray onto ray (an
 * axis on a ray or halfway between two), and the 2 to 5-fold turns are whole numbers of rays.
 */
const RAYS = 180;

/** The polygon's centroid (the outline is simple, so its signed area is not zero). */
function centroid(polygon: Point[]): Point {
  let [area2, x, y] = [0, 0, 0];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const cross = p.x * q.y - q.x * p.y;
    area2 += cross;
    x += (p.x + q.x) * cross;
    y += (p.y + q.y) * cross;
  });
  return { x: x / (3 * area2), y: y / (3 * area2) };
}

/**
 * The shape's area in each 2-degree sector round its centroid: along each ray, the stretches inside
 * the outline (between its crossings with the edges) give 1/2 (out^2 - in^2) of the sector's angle.
 */
function sectorAreas(polygon: Point[]): Float64Array {
  const c = centroid(polygon);
  const n = polygon.length;
  // Each edge as its direction (e) and its start relative to the centroid (w), worked out once:
  // this runs 180 rays over up to 160 edges for every shape drawn.
  const [ex, ey, wx, wy] = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)];
  for (let j = 0; j < n; j++) {
    const [p, q] = [polygon[j], polygon[(j + 1) % n]];
    [ex[j], ey[j], wx[j], wy[j]] = [q.x - p.x, q.y - p.y, p.x - c.x, p.y - c.y];
  }
  const sectors = new Float64Array(RAYS);
  const hits: number[] = [];
  for (let i = 0; i < RAYS; i++) {
    const angle = (TAU * (i + 0.5)) / RAYS;
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
    hits.length = 0;
    for (let j = 0; j < n; j++) {
      const denominator = dx * ey[j] - dy * ex[j];
      if (denominator === 0) continue;
      const along = (wx[j] * ey[j] - wy[j] * ex[j]) / denominator;
      const onEdge = (wx[j] * dy - wy[j] * dx) / denominator;
      if (along > 0 && onEdge >= 0 && onEdge < 1) hits.push(along);
    }
    hits.sort((a, b) => a - b);
    // An odd count means the ray starts inside: the centroid lies in the shape.
    if (hits.length % 2 === 1) hits.unshift(0);
    for (let k = 0; k + 1 < hits.length; k += 2) sectors[i] += (hits[k + 1] ** 2 - hits[k] ** 2) / 2;
  }
  return sectors;
}

/**
 * How far the outline is from symmetric: the smaller of its best mirror match (over 180 axes through
 * the centroid, 1 degree apart) and its best 2, 3, 4 or 5-fold turn, as the area that differs, a
 * share of the whole. Sector by sector the difference never exceeds the true one, so a symmetric
 * shape always measures near 0 and a shape that measures more really is lopsided.
 */
export function asymmetry(polygon: Point[]): number {
  const sectors = sectorAreas(polygon);
  const total = sectors.reduce((sum, area) => sum + area, 0);
  /** The area that differs from the image taking ray i to ray (sign * i + shift), over the total. */
  const differs = (sign: number, shift: number) => {
    let sum = 0;
    for (let i = 0; i < RAYS; i++) sum += Math.abs(sectors[i] - sectors[(((sign * i + shift) % RAYS) + RAYS) % RAYS]);
    return sum / total;
  };
  let least = Infinity;
  // Mirrored across the axis at `axis` degrees, the ray centred on 2i + 1 degrees lands on
  // 2 * axis - 2i - 1 degrees: ray axis - i - 1.
  for (let axis = 0; axis < 180; axis++) least = Math.min(least, differs(-1, axis - 1));
  for (const fold of [2, 3, 4, 5]) least = Math.min(least, differs(1, RAYS / fold));
  return least;
}

/** The farthest point from the centroid over the nearest one. */
function radiusRatio(polygon: Point[]): number {
  const c = centroid(polygon);
  const radii = polygon.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  return Math.max(...radii) / Math.min(...radii);
}

/** The least share of the box a kept shape may fill (the tests hold every shape to 25%). */
const MIN_KEPT_SHARE = 0.27;

const keepable = (shape: Point[]) =>
  polygonArea(shape) >= MIN_KEPT_SHARE * BOX * BOX && radiusRatio(shape) >= MIN_RADIUS_RATIO && asymmetry(shape) >= MIN_ASYMMETRY;

/** Draws tried before the fallback stands in. */
export const SHAPE_TRIES = 12;

/**
 * The shape used if every draw fails the checks: a fixed lopsided blob, tested to be simple, inside
 * the margin, lopsided and above the area floor (T221, T215). Over seeds 0 to 999 it is never needed.
 */
export const FALLBACK_SHAPE: readonly Point[] = fitted(
  polar(BLOB_POINTS, (a) => 1 + 0.25 * Math.cos(a + 0.4) + 0.18 * Math.cos(2 * a + 1.9) + 0.12 * Math.cos(3 * a + 4.1)),
  1,
  0.7,
  0.42,
);

/**
 * Shape `index` (0-based) of the run with this seed: a blob or a polygon by the run's styles, drawn
 * again until it is big enough, far from round and lopsided (T210, T221). `tries` is for tests.
 */
export function shapeFor(seed: number, index: number, tries = SHAPE_TRIES): Point[] {
  const style = stylesFor(seed)[index];
  const rng = createRng(mix(seed, index));
  for (let i = 0; i < tries; i++) {
    const shape = place(style === "blob" ? blob(rng) : polygon(rng), rng);
    if (keepable(shape)) return shape;
  }
  return [...FALLBACK_SHAPE];
}
