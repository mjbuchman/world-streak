/** Fair Split's canvas: the shape, the cut being dragged, the two sides after a cut, the time ring and a miss. */
import { BOX, clipLeft, type Point, type Polygon } from "./geometry";

export type FairSplitColors = { board: string; shape: string; left: string; right: string; line: string; ring: string; track: string; miss: string; text: string };

/** A cut drawn after it was made: the line (in shape units), the share on its left, and how far apart the sides have moved (shape units). */
export type DrawnSplit = { a: Point; b: Point; share: number; apart: number };

export type FairSplitFrame = {
  /** Canvas size in CSS pixels; the board is a square of the smaller side. */
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The shape on screen, or null in the pause between shapes. */
  polygon: Polygon | null;
  /** The cut being dragged, across the box, or null. */
  drag: readonly [Point, Point] | null;
  /** The last cut, shown in place of the whole shape, or null. */
  split: DrawnSplit | null;
  /** The share of the time limit left (1 to 0), or null for no ring. */
  timer: number | null;
  /** How strongly the miss tint shows, 0 (none) to 1. */
  miss: number;
  colors: FairSplitColors;
};

/** The space around the box, as a share of the board's side. */
export const BOARD_MARGIN = 0.06;
/** How long the two sides take to move apart after a cut, and how far they go (shape units). */
export const SEPARATE_MS = 300;
export const SEPARATE_UNITS = 3;

export type BoardLayout = { left: number; top: number; scale: number };

/** Where the 100 x 100 box sits on a canvas of this size (CSS pixels): centred, square, with a margin. */
export function boardLayout(width: number, height: number): BoardLayout {
  const side = Math.min(width, height);
  const margin = side * BOARD_MARGIN;
  return { left: (width - side) / 2 + margin, top: (height - side) / 2 + margin, scale: (side - 2 * margin) / BOX };
}

export const toCanvas = (layout: BoardLayout, p: Point): Point => ({ x: layout.left + p.x * layout.scale, y: layout.top + p.y * layout.scale });
export const toShape = (layout: BoardLayout, p: Point): Point => ({ x: (p.x - layout.left) / layout.scale, y: (p.y - layout.top) / layout.scale });

/**
 * The part of the infinite line through `a` and `b` inside the box, in the direction from `a` to
 * `b`, or null when the line misses the box (or `a` is `b`). A cut is sent this way, so its points
 * are always in the box while the line stays exactly the one dragged.
 */
export function lineThroughBox(a: Point, b: Point): [Point, Point] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;
  let low = -Infinity;
  let high = Infinity;
  for (const [start, delta] of [
    [a.x, dx],
    [a.y, dy],
  ]) {
    if (delta === 0) {
      if (start < 0 || start > BOX) return null;
      continue;
    }
    const [t0, t1] = [(0 - start) / delta, (BOX - start) / delta].sort((m, n) => m - n);
    low = Math.max(low, t0);
    high = Math.min(high, t1);
  }
  if (low >= high) return null;
  const at = (t: number) => ({ x: Math.min(BOX, Math.max(0, a.x + t * dx)), y: Math.min(BOX, Math.max(0, a.y + t * dy)) });
  return [at(low), at(high)];
}

/** The share of the time limit left `msSinceAppear` after the shape appeared. */
export const timerFraction = (msSinceAppear: number, limitMs: number) => Math.min(1, Math.max(0, 1 - msSinceAppear / limitMs));

/** How far apart the two sides are `msSinceCut` after a cut; under reduced motion they stay together. */
export function separation(msSinceCut: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return SEPARATE_UNITS * Math.min(1, Math.max(0, msSinceCut / SEPARATE_MS));
}

/** "49.6%": one decimal, enough to tell a fair cut from a near miss. */
export const percentLabel = (share: number) => `${(share * 100).toFixed(1)}%`;

function fillPolygon(ctx: CanvasRenderingContext2D, layout: BoardLayout, polygon: Polygon, color: string) {
  if (polygon.length === 0) return;
  ctx.beginPath();
  polygon.forEach((p, i) => {
    const { x, y } = toCanvas(layout, p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const shifted = (polygon: Polygon, by: Point) => polygon.map((p) => ({ x: p.x + by.x, y: p.y + by.y }));
const middle = (polygon: Polygon) => ({
  x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
  y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
});

function drawSplit(ctx: CanvasRenderingContext2D, layout: BoardLayout, polygon: Polygon, split: DrawnSplit, colors: FairSplitColors) {
  const length = Math.hypot(split.b.x - split.a.x, split.b.y - split.a.y);
  // The unit normal pointing to the left side of the cut.
  const normal = { x: -(split.b.y - split.a.y) / length, y: (split.b.x - split.a.x) / length };
  const sides = [
    { piece: clipLeft(polygon, split.a, split.b), sign: 1, color: colors.left, share: split.share },
    { piece: clipLeft(polygon, split.b, split.a), sign: -1, color: colors.right, share: 1 - split.share },
  ];
  ctx.font = `700 ${Math.round(layout.scale * 7)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const { piece, sign, color, share } of sides) {
    if (piece.length === 0) continue;
    const moved = shifted(piece, { x: sign * split.apart * normal.x, y: sign * split.apart * normal.y });
    fillPolygon(ctx, layout, moved, color);
    const label = toCanvas(layout, middle(moved));
    ctx.fillStyle = colors.text;
    ctx.fillText(percentLabel(share), label.x, label.y);
  }
}

function drawRing(ctx: CanvasRenderingContext2D, layout: BoardLayout, fraction: number, colors: FairSplitColors) {
  const radius = layout.scale * 4;
  const centre = toCanvas(layout, { x: BOX - 4, y: 4 });
  ctx.lineWidth = layout.scale * 1.5;
  ctx.strokeStyle = colors.track;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = colors.ring;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * fraction);
  ctx.stroke();
}

export function drawFairSplit(ctx: CanvasRenderingContext2D, frame: FairSplitFrame): void {
  const { width, height, devicePixelRatio, colors } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const side = Math.min(width, height);
  const boardLeft = (width - side) / 2;
  const boardTop = (height - side) / 2;
  ctx.fillStyle = colors.board;
  ctx.fillRect(boardLeft, boardTop, side, side);
  if (frame.miss > 0) {
    ctx.globalAlpha = frame.miss;
    ctx.fillStyle = colors.miss;
    ctx.fillRect(boardLeft, boardTop, side, side);
    ctx.globalAlpha = 1;
  }
  const layout = boardLayout(width, height);
  if (frame.polygon && frame.split) drawSplit(ctx, layout, frame.polygon, frame.split, colors);
  else if (frame.polygon) fillPolygon(ctx, layout, frame.polygon, colors.shape);
  if (frame.drag) {
    const [a, b] = frame.drag.map((p) => toCanvas(layout, p));
    ctx.lineWidth = Math.max(2, layout.scale * 0.6);
    ctx.strokeStyle = colors.line;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (frame.timer !== null) drawRing(ctx, layout, frame.timer, colors);
}
