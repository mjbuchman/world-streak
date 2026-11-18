import { createRng, type Rng } from "../shared/prng";
import { BOX, polygonArea, type Point } from "./geometry";

/**
 * Fair Split's shapes (T192): mostly curved and organic outlines, a few angular ones. Each kind is
 * built around the origin from a seeded RNG, then mirrored, turned, sized and centred in the box.
 * Curves are sampled densely, so the cut's area share (geometry.ts) works on them unchanged.
 * Every outline is simple: a polar curve (one radius per angle), a known simple curve, or one made
 * from two non-crossing arcs or two stacked graphs.
 */

export type ShapeKind = { name: string; curved: boolean; build: (rng: Rng) => Point[] };

/** The share of a run's shapes drawn from the curved kinds (proposed, owner to confirm; DECISIONS T192). */
export const CURVED_SHARE = 0.75;
/** Shapes per run whose kinds never repeat. */
export const KINDS_PER_RUN = 5;
/** The space kept clear inside the box, in shape units. */
export const MARGIN = 3;
/** A shape's area is drawn from this range, as a share of the box, then shrunk if it would not fit. */
export const AREA_SHARE = { min: 0.34, max: 0.5 } as const;

const TAU = 2 * Math.PI;
const between = (rng: Rng, min: number, max: number) => min + (max - min) * rng.next();

/** A curve with one radius per angle: always simple when the radius stays positive. */
const polar = (points: number, radius: (angle: number) => number): Point[] =>
  Array.from({ length: points }, (_, i) => {
    const angle = (TAU * i) / points;
    const r = radius(angle);
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });

/** A parametric closed curve sampled at `points` steps of t over one turn. */
const traced = (points: number, at: (t: number) => Point): Point[] => Array.from({ length: points }, (_, i) => at((TAU * i) / points));

/** Angles from `from` to `to` in `steps` equal steps, ends included. */
const sweep = (from: number, to: number, steps: number) => Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps);

/** The angle's distance from `centre`, wrapped to -pi..pi. */
const wrapped = (angle: number, centre: number) => Math.atan2(Math.sin(angle - centre), Math.cos(angle - centre));

function blob(rng: Rng): Point[] {
  const waves = [2, 3, 4].map((k) => ({ k, size: between(rng, 0.06, 0.13), phase: between(rng, 0, TAU) }));
  return polar(112, (a) => 1 + waves.reduce((sum, { k, size, phase }) => sum + size * Math.cos(k * a + phase), 0));
}

function flower(rng: Rng): Point[] {
  const petals = rng.int(5, 7);
  const depth = between(rng, 0.22, 0.32);
  return polar(140, (a) => 1 + depth * Math.cos(petals * a));
}

/** Round bumps meeting in small notches. */
function cloud(rng: Rng): Point[] {
  const bumps = rng.int(6, 8);
  const height = between(rng, 0.14, 0.2);
  return polar(144, (a) => 1 + height * Math.abs(Math.sin((bumps * a) / 2)));
}

function heart(rng: Rng): Point[] {
  const width = between(rng, 0.95, 1.1);
  return traced(128, (t) => ({
    x: width * 16 * Math.sin(t) ** 3,
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
  }));
}

/** A round end narrowing to a point. */
function teardrop(rng: Rng): Point[] {
  const fullness = between(rng, 1.3, 1.6);
  return traced(112, (t) => ({ x: Math.cos(t), y: fullness * Math.sin(t) * Math.sin(t / 2) }));
}

/** An oval with a dent in one long side. */
function kidneyBean(rng: Rng): Point[] {
  const dent = between(rng, 0.25, 0.35);
  const stretch = between(rng, 1.2, 1.35);
  return polar(120, (a) => 1 - dent * Math.exp(-((wrapped(a, Math.PI / 2) / 0.6) ** 2))).map((p) => ({ x: p.x * stretch, y: p.y }));
}

/** A teardrop bent into a comma: x stays, y shifts by a smooth function of x, which cannot fold it. */
function swoosh(rng: Rng): Point[] {
  const bend = between(rng, 0.45, 0.65);
  return traced(128, (t) => {
    const x = Math.cos(t);
    return { x, y: 1.5 * Math.sin(t) * Math.sin(t / 2) ** 1.5 + bend * (x + 1) ** 2 * 0.5 };
  });
}

/** A thick ring with a gap, its ends rounded. */
function thickC(rng: Rng): Point[] {
  const inner = between(rng, 0.48, 0.58);
  const gap = between(rng, (65 * Math.PI) / 180, (95 * Math.PI) / 180);
  const mid = (1 + inner) / 2;
  const half = (1 - inner) / 2;
  const start = gap / 2;
  const end = TAU - gap / 2;
  const onCircle = (r: number, a: number) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
  // A cap is half a circle round the end of the band, from one edge to the other.
  const cap = (at: number, outward: number, fromOuter: boolean) =>
    sweep(0, Math.PI, 12)
      .slice(1, -1)
      .map((s) => {
        const along = fromOuter ? Math.cos(s) : -Math.cos(s);
        return {
          x: mid * Math.cos(at) + half * (along * Math.cos(at) - outward * Math.sin(s) * Math.sin(at)),
          y: mid * Math.sin(at) + half * (along * Math.sin(at) + outward * Math.sin(s) * Math.cos(at)),
        };
      });
  return [
    ...sweep(start, end, 64).map((a) => onCircle(1, a)),
    ...cap(end, 1, true),
    ...sweep(end, start, 56).map((a) => onCircle(inner, a)),
    ...cap(start, -1, false),
  ];
}

/** A disc with a smaller disc taken out of one side. */
function crescent(rng: Rng): Point[] {
  const offset = between(rng, 0.55, 0.7);
  const bite = between(rng, 0.72, 0.82);
  // Where the two circles meet: x from subtracting their equations, y from the outer circle.
  const meetX = (1 + offset * offset - bite * bite) / (2 * offset);
  const meetY = Math.sqrt(1 - meetX * meetX);
  const outerFrom = Math.atan2(meetY, meetX);
  const innerFrom = Math.atan2(-meetY, meetX - offset);
  const innerTo = Math.atan2(meetY, meetX - offset);
  return [
    ...sweep(outerFrom, TAU - outerFrom, 80).map((a) => ({ x: Math.cos(a), y: Math.sin(a) })),
    // Back round the bite's near side (through its leftmost point), ends left out: they are the corners above.
    ...sweep(innerFrom, innerTo - TAU, 64)
      .slice(1, -1)
      .map((a) => ({ x: offset + bite * Math.cos(a), y: bite * Math.sin(a) })),
  ];
}

function arrow(rng: Rng): Point[] {
  const shaft = between(rng, 0.28, 0.34);
  const head = between(rng, 0.72, 0.82);
  const neck = between(rng, 0.05, 0.2);
  return [
    { x: -0.8, y: -shaft },
    { x: neck, y: -shaft },
    { x: neck, y: -head },
    { x: 1, y: 0 },
    { x: neck, y: head },
    { x: neck, y: shaft },
    { x: -0.8, y: shaft },
  ];
}

function star(rng: Rng): Point[] {
  const tips = rng.int(5, 7);
  const inner = between(rng, 0.52, 0.62);
  return polar(2 * tips, (a) => (Math.round((a * tips) / Math.PI) % 2 === 0 ? 1 : inner));
}

function cross(rng: Rng): Point[] {
  const arm = between(rng, 0.36, 0.44);
  const corners = [
    [arm, -1],
    [arm, -arm],
    [1, -arm],
    [1, arm],
    [arm, arm],
    [arm, 1],
  ];
  return [...corners, ...corners.map(([x, y]) => [-x, -y])].map(([x, y]) => ({ x, y }));
}

/** A thick band zig-zagging across: its top and bottom edges are the same graph shifted, so they never meet. */
function zigZag(rng: Rng): Point[] {
  const teeth = rng.int(2, 3);
  const height = between(rng, 0.3, 0.4);
  const thickness = between(rng, 0.32, 0.4);
  const xs = Array.from({ length: 2 * teeth + 1 }, (_, i) => -1 + (2 * i) / (2 * teeth));
  const middle = xs.map((x, i) => ({ x, y: i % 2 === 0 ? height : -height }));
  return [...middle.map((p) => ({ x: p.x, y: p.y - thickness })), ...middle.reverse().map((p) => ({ x: p.x, y: p.y + thickness }))];
}

export const SHAPE_KINDS: readonly ShapeKind[] = [
  { name: "blob", curved: true, build: blob },
  { name: "flower", curved: true, build: flower },
  { name: "cloud", curved: true, build: cloud },
  { name: "heart", curved: true, build: heart },
  { name: "teardrop", curved: true, build: teardrop },
  { name: "kidney bean", curved: true, build: kidneyBean },
  { name: "swoosh", curved: true, build: swoosh },
  { name: "thick C", curved: true, build: thickC },
  { name: "crescent", curved: true, build: crescent },
  { name: "arrow", curved: false, build: arrow },
  { name: "star", curved: false, build: star },
  { name: "cross", curved: false, build: cross },
  { name: "zig-zag", curved: false, build: zigZag },
];

/** Mixes a seed and an index into one 32-bit seed, so neighbouring indices differ. */
const mix = (seed: number, index: number) => (seed ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0;

/**
 * A run's kinds, all different: each draw takes a curved kind with chance CURVED_SHARE (an angular
 * one otherwise), from the kinds not drawn yet.
 */
export function kindsFor(seed: number): ShapeKind[] {
  const rng = createRng(mix(seed, KINDS_PER_RUN));
  const left = [...SHAPE_KINDS];
  return Array.from({ length: KINDS_PER_RUN }, () => {
    const wantCurved = rng.next() < CURVED_SHARE;
    const pool = left.filter((kind) => kind.curved === wantCurved);
    const kind = rng.pick(pool.length > 0 ? pool : left);
    left.splice(left.indexOf(kind), 1);
    return kind;
  });
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
 * itself, as a share of its area (T210; proposed, owner to confirm). Over seeds 0 to 999 the least
 * lopsided drawn shape measures 0.040; before warping, the plain kinds measured as low as 0.031.
 */
export const MIN_ASYMMETRY = 0.04;
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
  // this runs 360 rays over up to 160 edges for every shape drawn.
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

/** Straight-edged kinds get points along their edges first, so the warp bends edges and cannot fold them. */
const DENSE_POINTS = 120;

function densified(outline: Point[]): Point[] {
  if (outline.length >= DENSE_POINTS) return outline;
  const edges = outline.map((p, i) => [p, outline[(i + 1) % outline.length]] as const);
  const perimeter = edges.reduce((sum, [p, q]) => sum + Math.hypot(q.x - p.x, q.y - p.y), 0);
  return edges.flatMap(([p, q]) => {
    const pieces = Math.max(1, Math.round((Math.hypot(q.x - p.x, q.y - p.y) / perimeter) * DENSE_POINTS));
    return Array.from({ length: pieces }, (_, k) => ({ x: p.x + ((q.x - p.x) * k) / pieces, y: p.y + ((q.y - p.y) * k) / pieces }));
  });
}

/**
 * The outline stretched away from the origin by a seeded amount that varies smoothly with direction:
 * one, two and three waves a turn at random phases, whose mirror axes and turns never line up. The
 * stretch stays positive, so each ray from the origin is only rescaled and the outline stays simple.
 */
function warped(outline: Point[], rng: Rng): Point[] {
  const waves = [
    { k: 1, size: between(rng, 0.06, 0.12) },
    { k: 2, size: between(rng, 0.06, 0.12) },
    { k: 3, size: between(rng, 0.04, 0.08) },
  ].map((wave) => ({ ...wave, phase: between(rng, 0, TAU) }));
  return densified(outline).map(({ x, y }) => {
    const angle = Math.atan2(y, x);
    const stretch = 1 + waves.reduce((sum, { k, size, phase }) => sum + size * Math.cos(k * angle + phase), 0);
    return { x: x * stretch, y: y * stretch };
  });
}

/** Warps tried before the last one stands. */
const WARP_TRIES = 12;
/** The least share of the box a kept warp may fill (the tests hold every shape to 25%). */
const MIN_KEPT_SHARE = 0.27;

/**
 * Shape `index` (0-based) of the run with this seed: its kind, then a seeded outline of that kind,
 * warped until it is lopsided (T210: the owner asked for no symmetric shapes).
 */
export function shapeFor(seed: number, index: number): Point[] {
  const kind = kindsFor(seed)[index];
  const rng = createRng(mix(seed, index));
  const outline = kind.build(rng);
  // Over seeds 0 to 999 every shape passes within these tries; the last try stands regardless.
  for (let i = 1; i < WARP_TRIES; i++) {
    const shape = place(warped(outline, rng), rng);
    // A warp can stretch a long shape until fitting it in the box leaves it too small.
    if (asymmetry(shape) >= MIN_ASYMMETRY && polygonArea(shape) >= MIN_KEPT_SHARE * BOX * BOX) return shape;
  }
  return place(warped(outline, rng), rng);
}
