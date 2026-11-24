/**
 * Bank Shot's canvas (T232): the board between its two walls, the finish line along the top with
 * a tap strip above it, the puck and its trail during the glimpse, the spinning bumper, the
 * player's marker, and after a tap the real path, the real crossing and the miss. Everything is
 * drawn from the frame alone, so the same elapsed ms always draws the same picture.
 */
import { flight, FREE_UNITS, type BankShotParams, type BankShotRound } from "./engine";
import { BOARD_H, BOARD_W, rotatingBar, type BarTrace, type RotatingBar, type Vec, type WallHit } from "./geometry";

export type BankShotColors = { board: string; wall: string; line: string; strip: string; puck: string; bumper: string; marker: string; crossing: string; path: string; miss: string; text: string };

/** The space around the board and the tap strip above the finish line, in board units. */
export const MARGIN_UNITS = 4;
export const STRIP_UNITS = 16;
/** How much of the puck's recent path its fading trail shows, and in how many dots. */
export const TRAIL_MS = 240;
const TRAIL_DOTS = 6;
const PUCK_RADIUS = 2.4;
/** The free-zone band's height across the finish line, and where the miss label sits, in board units. */
export const FREE_BAND_UNITS = 4;
const MISS_LABEL_Y = 20;

export type BoardLayout = { left: number; top: number; scale: number };

/** The board's width and height with its margins and strip, in board units: the canvas's aspect. */
export const LAYOUT_UNITS = { width: BOARD_W + 2 * MARGIN_UNITS, height: BOARD_H + STRIP_UNITS + 2 * MARGIN_UNITS } as const;

/** Where the board sits on a canvas of this size (CSS px): as large as fits, centred; `top` is the finish line. */
export function boardLayout(width: number, height: number): BoardLayout {
  const scale = Math.min(width / LAYOUT_UNITS.width, height / LAYOUT_UNITS.height);
  const left = (width - BOARD_W * scale) / 2;
  const top = (height - LAYOUT_UNITS.height * scale) / 2 + (MARGIN_UNITS + STRIP_UNITS) * scale;
  return { left, top, scale };
}

export const toCanvas = (layout: BoardLayout, x: number, y: number): Vec => ({ x: layout.left + x * layout.scale, y: layout.top + y * layout.scale });
export const toBoard = (layout: BoardLayout, px: number, py: number): Vec => ({ x: (px - layout.left) / layout.scale, y: (py - layout.top) / layout.scale });
/** The finish-line x under a canvas x: any tap on the board picks the spot straight above it. */
export const markerX = (layout: BoardLayout, px: number) => Math.min(BOARD_W, Math.max(0, toBoard(layout, px, 0).x));

/** The shot's corners in order, from launch to the finish line, each with its time. */
export function pathOf(round: BankShotRound): WallHit[] {
  const trace = flight(round);
  const turns = "turns" in trace ? (trace as BarTrace).turns : trace.hits;
  return [{ ...round.start, atMs: 0 }, ...turns, { x: trace.crossing.x, y: 0, atMs: trace.crossing.atMs }];
}

/** Where the puck is `ms` after launch on a path, moving straight between its corners. */
function along(path: WallHit[], ms: number): Vec {
  const i = Math.max(1, path.findIndex((p) => p.atMs >= ms));
  const [a, b] = [path[i - 1], path[i]];
  const f = b.atMs === a.atMs ? 0 : (ms - a.atMs) / (b.atMs - a.atMs);
  return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) };
}

/** The puck `msSinceLaunch` into round `round`, or null outside its glimpse. Shared by the canvas and the tests. */
export function puckAt(params: BankShotParams, round: number, msSinceLaunch: number): Vec | null {
  const shot = params.rounds[round];
  if (msSinceLaunch < 0 || msSinceLaunch > shot.glimpseMs) return null;
  return along(pathOf(shot), msSinceLaunch);
}

/** The bumper's angle (radians) `ms` after launch. */
export const bumperAngle = (bar: RotatingBar, ms: number) => bar.phase + bar.omegaPerMs * ms;

/** "34°": the bar's tilt from level, for the reduced-motion still picture. */
export function angleLabel(radians: number): string {
  const degrees = (((radians * 180) / Math.PI) % 180 + 180) % 180;
  return `${Math.round(degrees)}°`;
}

/** Board units to one decimal ("13.5"). */
export const oneDecimal = (value: number) => `${Math.round(value * 10) / 10}`;

/** "On target, no cost" inside the free zone, else "Missed by 4.2, cost 1.2" (T248). */
export const missLabel = (miss: number, cost: number) =>
  cost === 0 ? "On target, no cost" : `Missed by ${oneDecimal(miss)}, cost ${cost < 0.05 ? "under 0.1" : oneDecimal(cost)}`;

/** The free zone's ends on the finish line: FREE_UNITS each side of the crossing, inside the walls. */
export const freeZone = (crossingX: number) => ({ from: Math.max(0, crossingX - FREE_UNITS), to: Math.min(BOARD_W, crossingX + FREE_UNITS) });

export type BankShotFrame = {
  width: number;
  height: number;
  devicePixelRatio: number;
  params: BankShotParams;
  /** The round on screen, or null for an empty board. */
  round: number | null;
  /** Ms since this round's launch (negative during its 3-2-1). */
  msSinceLaunch: number;
  /** The player's marker on the finish line, in board units, or null before one is placed. */
  marker: number | null;
  /** After a tap or a timeout: the real path, its crossing, and the tap's distance and cost (null on a timeout). */
  reveal: { crossingX: number; miss: number | null; cost: number | null } | null;
  /** How strongly the miss tint shows, 0 (none) to 1. */
  missTint: number;
  reducedMotion: boolean;
  colors: BankShotColors;
};

function segment(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function disc(ctx: CanvasRenderingContext2D, at: Vec, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, layout: BoardLayout, text: string, at: Vec, color: string) {
  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(layout.scale * 4.2)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, at.x, at.y);
}

export function drawBankShot(ctx: CanvasRenderingContext2D, frame: BankShotFrame): void {
  const { width, height, devicePixelRatio, colors, params } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const layout = boardLayout(width, height);
  const at = (x: number, y: number) => toCanvas(layout, x, y);
  const { x: left, y: top } = at(0, 0);
  const side = BOARD_W * layout.scale;
  ctx.fillStyle = colors.strip;
  ctx.fillRect(left, top - STRIP_UNITS * layout.scale, side, STRIP_UNITS * layout.scale);
  ctx.fillStyle = colors.board;
  ctx.fillRect(left, top, side, BOARD_H * layout.scale);
  if (frame.missTint > 0) {
    ctx.globalAlpha = frame.missTint;
    ctx.fillStyle = colors.miss;
    ctx.fillRect(left, top, side, BOARD_H * layout.scale);
    ctx.globalAlpha = 1;
  }
  // The walls are thick bars, the finish line a dashed one, so neither depends on colour alone.
  ctx.strokeStyle = colors.wall;
  ctx.lineWidth = Math.max(3, layout.scale * 1.2);
  segment(ctx, at(0, -STRIP_UNITS), at(0, BOARD_H));
  segment(ctx, at(BOARD_W, -STRIP_UNITS), at(BOARD_W, BOARD_H));
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = Math.max(2, layout.scale * 0.6);
  ctx.setLineDash([layout.scale * 3, layout.scale * 2]);
  segment(ctx, at(0, 0), at(BOARD_W, 0));
  ctx.setLineDash([]);
  label(ctx, layout, "FINISH", at(BOARD_W / 2, -STRIP_UNITS / 2), colors.text);

  if (frame.round === null) return;
  const shot = params.rounds[frame.round];
  if (shot.bumper) drawBumper(ctx, layout, shot, frame);
  if (frame.reveal) drawReveal(ctx, layout, shot, frame.reveal, colors);
  else drawPuck(ctx, layout, frame);
  if (frame.marker !== null) drawMarker(ctx, layout, frame.marker, colors);
}

function drawBumper(ctx: CanvasRenderingContext2D, layout: BoardLayout, shot: BankShotRound, frame: BankShotFrame) {
  const bar = shot.bumper!;
  // Reduced motion: a still bar where it stood when the puck met it (or at launch), with its angle.
  const ms = frame.reducedMotion ? (flightBarHitMs(shot) ?? 0) : frame.msSinceLaunch;
  const { a, b } = rotatingBar(bar.center, bar.length, bar.omegaPerMs, bar.phase, ms);
  ctx.strokeStyle = frame.colors.bumper;
  ctx.lineWidth = Math.max(4, layout.scale * 1.6);
  ctx.lineCap = "round";
  segment(ctx, toCanvas(layout, a.x, a.y), toCanvas(layout, b.x, b.y));
  ctx.lineCap = "butt";
  disc(ctx, toCanvas(layout, bar.center.x, bar.center.y), layout.scale * 1.2, frame.colors.board);
  if (frame.reducedMotion) label(ctx, layout, angleLabel(bumperAngle(bar, ms)), toCanvas(layout, bar.center.x, bar.center.y + 6), frame.colors.text);
}

function flightBarHitMs(shot: BankShotRound): number | null {
  const trace = flight(shot) as Partial<BarTrace>;
  return trace.barHits?.[0]?.atMs ?? null;
}

function drawPuck(ctx: CanvasRenderingContext2D, layout: BoardLayout, frame: BankShotFrame) {
  const round = frame.round!;
  const puck = puckAt(frame.params, round, frame.msSinceLaunch);
  if (!puck) return;
  if (!frame.reducedMotion) {
    for (let i = TRAIL_DOTS; i >= 1; i--) {
      const back = puckAt(frame.params, round, frame.msSinceLaunch - (i * TRAIL_MS) / TRAIL_DOTS);
      if (!back) continue;
      ctx.globalAlpha = 0.5 * (1 - i / (TRAIL_DOTS + 1));
      disc(ctx, toCanvas(layout, back.x, back.y), layout.scale * PUCK_RADIUS * 0.7, frame.colors.puck);
    }
    ctx.globalAlpha = 1;
  }
  disc(ctx, toCanvas(layout, puck.x, puck.y), layout.scale * PUCK_RADIUS, frame.colors.puck);
}

/** The player's guess: a downward triangle on the line, labelled "You". */
function drawMarker(ctx: CanvasRenderingContext2D, layout: BoardLayout, x: number, colors: BankShotColors) {
  const tip = toCanvas(layout, x, 0);
  const s = layout.scale * 3;
  ctx.fillStyle = colors.marker;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - s, tip.y - 2 * s);
  ctx.lineTo(tip.x + s, tip.y - 2 * s);
  ctx.closePath();
  ctx.fill();
  label(ctx, layout, "You", { x: tip.x, y: tip.y - 2 * s - layout.scale * 3 }, colors.text);
}

/**
 * The free zone: an outlined band across the finish line, labelled, so it never depends on colour
 * alone. It is still, so reduced motion shows it unchanged.
 */
function drawFreeZone(ctx: CanvasRenderingContext2D, layout: BoardLayout, crossingX: number, colors: BankShotColors) {
  const { from, to } = freeZone(crossingX);
  const corner = toCanvas(layout, from, -FREE_BAND_UNITS / 2);
  const w = (to - from) * layout.scale;
  const h = FREE_BAND_UNITS * layout.scale;
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = colors.crossing;
  ctx.fillRect(corner.x, corner.y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.crossing;
  ctx.lineWidth = Math.max(1.5, layout.scale * 0.4);
  ctx.strokeRect(corner.x, corner.y, w, h);
  label(ctx, layout, "Free zone", toCanvas(layout, Math.min(BOARD_W - 12, Math.max(12, crossingX)), 11), colors.text);
}

/** A tick beside the miss label: the free-zone guess is marked by a shape as well as its text. */
function drawTick(ctx: CanvasRenderingContext2D, layout: BoardLayout, at: Vec, colors: BankShotColors) {
  const s = layout.scale * 1.6;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = Math.max(2, layout.scale * 0.6);
  ctx.beginPath();
  ctx.moveTo(at.x - s, at.y);
  ctx.lineTo(at.x - s / 3, at.y + s * 0.7);
  ctx.lineTo(at.x + s, at.y - s * 0.8);
  ctx.stroke();
}

/** The real path, the free zone, a ring at the real crossing labelled "Here", and the miss and its cost. */
function drawReveal(ctx: CanvasRenderingContext2D, layout: BoardLayout, shot: BankShotRound, reveal: NonNullable<BankShotFrame["reveal"]>, colors: BankShotColors) {
  const points = pathOf(shot).map((p) => toCanvas(layout, p.x, p.y));
  ctx.strokeStyle = colors.path;
  ctx.lineWidth = Math.max(2, layout.scale * 0.6);
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  drawFreeZone(ctx, layout, reveal.crossingX, colors);
  const real = toCanvas(layout, reveal.crossingX, 0);
  ctx.strokeStyle = colors.crossing;
  ctx.lineWidth = Math.max(2, layout.scale * 0.8);
  ctx.beginPath();
  ctx.arc(real.x, real.y, layout.scale * 2.6, 0, 2 * Math.PI);
  ctx.stroke();
  label(ctx, layout, "Here", { x: real.x, y: real.y + layout.scale * 6 }, colors.text);
  if (reveal.miss === null || reveal.cost === null) return;
  const at = toCanvas(layout, BOARD_W / 2, MISS_LABEL_Y);
  label(ctx, layout, missLabel(reveal.miss, reveal.cost), at, colors.text);
  if (reveal.cost === 0) drawTick(ctx, layout, { x: at.x - layout.scale * 26, y: at.y }, colors);
}
