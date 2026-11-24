import type { ArrowFlipPrompt, Cue, Direction } from "./engine";

/**
 * Arrow Flip's canvas (T237). Everything is told apart by shape and text, never colour alone: the
 * arrow's direction is its shape, the cue is a word in a differently shaped frame (a rounded
 * rectangle for WORD, a frame with pointed ends for ARROW), and feedback is a tick or a cross with
 * text.
 */

export type ArrowFlipColors = { board: string; arrow: string; word: string; badge: string; right: string; wrong: string; bar: string; track: string; text: string };

/** What the last answer showed: right, wrong or too slow, and the direction that was right. */
export type ArrowFlipFeedback = { result: "right" | "wrong" | "timeout"; answer: Direction };

export type ArrowFlipFrame = {
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The prompt on screen, or null between prompts and during a 3-2-1. */
  prompt: ArrowFlipPrompt | null;
  msSincePrompt: number;
  limitMs: number;
  feedback: ArrowFlipFeedback | null;
  reducedMotion: boolean;
  colors: ArrowFlipColors;
};

/** How long a new prompt slides in; reduced motion skips it. */
export const SLIDE_MS = 120;
/** The smallest text on the canvas, in CSS px. */
export const MIN_TEXT_PX = 28;
const PAD = 16;

type Box = { cx: number; cy: number; w: number; h: number };

/** Where the badge, the arrow, the word and the limit bar go on a `width` x `height` canvas. */
export function promptLayout(width: number, height: number) {
  const badge: Box = { cx: width / 2, cy: PAD + 28, w: Math.min(width - 2 * PAD, 200), h: 56 };
  const size = Math.min(width * 0.5, height * 0.3);
  const arrow: Box = { cx: width / 2, cy: height * 0.42, w: size, h: size };
  const fontPx = Math.max(MIN_TEXT_PX, Math.min(64, Math.round(width * 0.12)));
  const word: Box = { cx: width / 2, cy: height * 0.7, w: width - 2 * PAD, h: fontPx };
  const bar = { x: PAD, y: height - PAD - 8, w: width - 2 * PAD, h: 8 };
  return { badge, arrow, word, bar, fontPx };
}

/** The share of the prompt's time limit still left: 1 when it appears, 0 at the limit. */
export const limitFraction = (msSincePrompt: number, limitMs: number) => Math.min(1, Math.max(0, 1 - msSincePrompt / limitMs));

/** The sideways offset of a prompt sliding in from the right. */
export const slideOffset = (msSincePrompt: number, width: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : (1 - Math.min(1, Math.max(0, msSincePrompt / SLIDE_MS))) ** 2 * width * 0.08;

const ANGLES: Record<Direction, number> = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

/** A block arrow `box.w` long around the box's centre, drawn pointing right and turned to `dir`. */
function drawArrow(ctx: CanvasRenderingContext2D, box: Box, dir: Direction, color: string) {
  const s = box.w / 2;
  const points: [number, number][] = [
    [-s, -s * 0.22],
    [s * 0.15, -s * 0.22],
    [s * 0.15, -s * 0.6],
    [s, 0],
    [s * 0.15, s * 0.6],
    [s * 0.15, s * 0.22],
    [-s, s * 0.22],
  ];
  const [cos, sin] = [Math.cos(ANGLES[dir]), Math.sin(ANGLES[dir])];
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    const px = box.cx + x * cos - y * sin;
    const py = box.cy + x * sin + y * cos;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** The cue's frame: a rounded rectangle for WORD, pointed ends for ARROW. */
function drawBadge(ctx: CanvasRenderingContext2D, box: Box, cue: Cue, colors: ArrowFlipColors) {
  const [l, r, t, b] = [box.cx - box.w / 2, box.cx + box.w / 2, box.cy - box.h / 2, box.cy + box.h / 2];
  ctx.beginPath();
  if (cue === "word") {
    ctx.roundRect(l, t, box.w, box.h, 14);
  } else {
    const tip = box.h / 2;
    ctx.moveTo(l, box.cy);
    ctx.lineTo(l + tip, t);
    ctx.lineTo(r - tip, t);
    ctx.lineTo(r, box.cy);
    ctx.lineTo(r - tip, b);
    ctx.lineTo(l + tip, b);
    ctx.closePath();
  }
  ctx.strokeStyle = colors.badge;
  ctx.lineWidth = 4;
  ctx.stroke();
  text(ctx, cue === "word" ? "WORD" : "ARROW", box.cx, box.cy, MIN_TEXT_PX, colors.text);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string) {
  ctx.font = `800 ${px}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** A tick for a right answer, a cross otherwise, in the arrow's place. */
function drawMark(ctx: CanvasRenderingContext2D, box: Box, right: boolean, color: string) {
  const s = box.w * 0.35;
  ctx.beginPath();
  if (right) {
    ctx.moveTo(box.cx - s, box.cy);
    ctx.lineTo(box.cx - s * 0.3, box.cy + s * 0.7);
    ctx.lineTo(box.cx + s, box.cy - s * 0.7);
  } else {
    ctx.moveTo(box.cx - s, box.cy - s);
    ctx.lineTo(box.cx + s, box.cy + s);
    ctx.moveTo(box.cx + s, box.cy - s);
    ctx.lineTo(box.cx - s, box.cy + s);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(8, box.w * 0.08);
  ctx.lineCap = "round";
  ctx.stroke();
}

const FEEDBACK_TITLE = { right: "Right", wrong: "Wrong", timeout: "Too slow" } as const;

export function drawArrowFlip(ctx: CanvasRenderingContext2D, frame: ArrowFlipFrame): void {
  const { width, height, devicePixelRatio, colors, prompt, feedback } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, width, height);
  const layout = promptLayout(width, height);
  if (feedback) {
    const right = feedback.result === "right";
    drawMark(ctx, layout.arrow, right, right ? colors.right : colors.wrong);
    text(ctx, FEEDBACK_TITLE[feedback.result], layout.badge.cx, layout.badge.cy, layout.fontPx, colors.text);
    if (!right) text(ctx, `It was ${feedback.answer.toUpperCase()}`, layout.word.cx, layout.word.cy, layout.fontPx, colors.text);
    return;
  }
  if (!prompt) return;
  const dx = slideOffset(frame.msSincePrompt, width, frame.reducedMotion);
  drawBadge(ctx, layout.badge, prompt.cue, colors);
  drawArrow(ctx, { ...layout.arrow, cx: layout.arrow.cx + dx }, prompt.arrow, colors.arrow);
  text(ctx, prompt.word.toUpperCase(), layout.word.cx + dx, layout.word.cy, layout.fontPx, colors.word);
  const { bar } = layout;
  ctx.fillStyle = colors.track;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = colors.bar;
  ctx.fillRect(bar.x, bar.y, bar.w * limitFraction(frame.msSincePrompt, frame.limitMs), bar.h);
}
