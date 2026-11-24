/**
 * Bank Shot geometry (T230): a point puck on a BOARD_W x BOARD_H board, launched from the bottom
 * edge towards the finish line at the top (y = 0), bouncing off the two side walls. Units are board
 * units; time is elapsed ms. No physics library: a straight shot has a closed form (the walls
 * unfold into a triangle wave), which keeps the server replay cheap and exact. Only the spinning
 * bumper needs stepping, in fixed 1 ms ticks, so a result depends on elapsed ms, never on frames.
 */

export const BOARD_W = 100;
export const BOARD_H = 150;
/** The stepping trace's fixed tick. */
export const TICK_MS = 1;
/** Float slack: a wall hit this close to the crossing counts as the crossing (a corner shot). */
const EPS = 1e-9;

export type Vec = { x: number; y: number };
export type Board = { width: number; height: number };
export type WallHit = { x: number; y: number; atMs: number };
export type Crossing = { x: number; atMs: number };
export type Trace = { hits: WallHit[]; crossing: Crossing };

export const BOARD: Board = { width: BOARD_W, height: BOARD_H };

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;

/** `direction` mirrored off a surface with this normal (any length): d - 2 (d.n / n.n) n. */
export function reflect(direction: Vec, normal: Vec): Vec {
  const k = (2 * dot(direction, normal)) / dot(normal, normal);
  return { x: direction.x - k * normal.x, y: direction.y - k * normal.y };
}

/** Folds an unbounded x back between the walls 0 and `width` (the triangle wave). */
function fold(u: number, width: number): number {
  const m = ((u % (2 * width)) + 2 * width) % (2 * width);
  return m <= width ? m : 2 * width - m;
}

/** The puck's x after `t` ms, bouncing between walls at 0 and `width`, without stepping. */
export const unfoldedX = (x0: number, vx: number, t: number, width: number) => fold(x0 + vx * t, width);

/** When a puck at height `y0` moving at `vy` (negative is up) reaches the finish line. */
export function crossingTime(y0: number, vy: number): number {
  if (!(vy < 0) || !(y0 > 0)) throw new RangeError(`the puck must start below the line and move up, got y0 ${y0}, vy ${vy}`);
  return -y0 / vy;
}

/**
 * Every wall hit and the finish-line crossing of a straight shot. The start must be strictly
 * between the walls. A wall hit at the very moment of the crossing (a shot into a top corner) is
 * not a bounce: the puck crosses at that wall's x. This is the one deterministic rule for corners.
 */
export function traceStraight(start: Vec, velocity: Vec, board: Board = BOARD): Trace {
  const { width } = board;
  if (!(start.x > 0 && start.x < width)) throw new RangeError(`the start must be between the walls, got x ${start.x}`);
  const total = crossingTime(start.y, velocity.y);
  const end = start.x + velocity.x * total;
  const hits: WallHit[] = [];
  const step = Math.sign(velocity.x);
  // The walls the unfolded path passes are the multiples of `width` strictly between start and end.
  for (let k = step > 0 ? 1 : 0; step !== 0 && step * (k * width - end) < -EPS; k += step) {
    const atMs = (k * width - start.x) / velocity.x;
    hits.push({ x: k % 2 === 0 ? 0 : width, y: start.y + velocity.y * atMs, atMs });
  }
  return { hits, crossing: { x: fold(end, width), atMs: total } };
}

export type Segment = { a: Vec; b: Vec };
export type RotatingBar = { center: Vec; length: number; omegaPerMs: number; phase: number };

/** The bumper's endpoints at `atMs`: a bar spinning about its centre at `omegaPerMs` radians a ms. */
export function rotatingBar(center: Vec, length: number, omegaPerMs: number, phase: number, atMs: number): Segment {
  const angle = phase + omegaPerMs * atMs;
  const dx = (Math.cos(angle) * length) / 2;
  const dy = (Math.sin(angle) * length) / 2;
  return { a: { x: center.x - dx, y: center.y - dy }, b: { x: center.x + dx, y: center.y + dy } };
}

export type BarContact = { point: Vec; velocity: Vec };

/**
 * Whether the move from `prev` to `next` (one tick) meets the bar where it stands at `atMs`, and if
 * so the contact point and the velocity reflected off the bar's normal. The bar's own surface speed
 * is ignored (a documented simplification). Both ends of the move and of the bar count, so a
 * contact exactly on a tick boundary is never lost between two ticks.
 */
export function barHit(prev: Vec, next: Vec, bar: RotatingBar, atMs: number): BarContact | null {
  const { a, b } = rotatingBar(bar.center, bar.length, bar.omegaPerMs, bar.phase, atMs);
  const move = { x: next.x - prev.x, y: next.y - prev.y };
  const side = { x: b.x - a.x, y: b.y - a.y };
  const denom = move.x * side.y - move.y * side.x;
  if (denom === 0) return null;
  const rel = { x: a.x - prev.x, y: a.y - prev.y };
  const s = (rel.x * side.y - rel.y * side.x) / denom; // along the move
  const u = (rel.x * move.y - rel.y * move.x) / denom; // along the bar
  if (s < -EPS || s > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  const velocity = reflect({ x: move.x / TICK_MS, y: move.y / TICK_MS }, { x: -side.y, y: side.x });
  return { point: { x: prev.x + s * move.x, y: prev.y + s * move.y }, velocity };
}

export type BarTrace = Trace & { barHits: WallHit[] };

/**
 * A shot past a spinning bumper, stepped in 1 ms ticks: side walls and the bottom edge reflect, the
 * bar reflects by `barHit`, and the crossing is interpolated within its tick. Returns null if the
 * puck has not crossed by `maxMs`.
 */
export function traceWithBar(start: Vec, velocity: Vec, bar: RotatingBar, maxMs: number, board: Board = BOARD): BarTrace | null {
  const { width } = board;
  const hits: WallHit[] = []; // side walls only; the bottom edge reflects but is not a bounce
  const barHits: WallHit[] = [];
  let pos = start;
  let v = velocity;
  let justHit = false;
  for (let t = 0; t < maxMs; t += TICK_MS) {
    const next = { x: pos.x + v.x * TICK_MS, y: pos.y + v.y * TICK_MS };
    // The tick after a contact starts on the bar, so it skips the bar rather than catch it again.
    const contact: BarContact | null = justHit ? null : barHit(pos, next, bar, t);
    justHit = contact !== null;
    if (contact) {
      barHits.push({ ...contact.point, atMs: t });
      // The rest of this tick's move is dropped: a small, deterministic loss the server shares.
      pos = contact.point;
      v = contact.velocity;
      continue;
    }
    if (next.y <= 0) {
      const f = pos.y / (pos.y - next.y);
      return { hits, barHits, crossing: { x: Math.min(width, Math.max(0, pos.x + f * (next.x - pos.x))), atMs: t + f * TICK_MS } };
    }
    pos = bounceOffEdges(pos, next, t, board, hits, (wall) => (v = reflect(v, wall)));
  }
  return null;
}

/** Folds a tick's move back inside the side walls and the bottom edge, logging each hit. */
function bounceOffEdges(pos: Vec, next: Vec, t: number, { width, height }: Board, hits: WallHit[], turn: (normal: Vec) => void): Vec {
  let { x, y } = next;
  const at = (f: number) => ({ y: pos.y + f * (next.y - pos.y), atMs: t + f * TICK_MS });
  if (x < 0 || x > width) {
    const wall = x < 0 ? 0 : width;
    hits.push({ x: wall, ...at((wall - pos.x) / (next.x - pos.x)) });
    x = 2 * wall - x;
    turn({ x: 1, y: 0 });
  }
  if (y > height) {
    y = 2 * height - y;
    turn({ x: 0, y: 1 });
  }
  return { x, y };
}
