import type { Colour, InkWord } from "./engine";
import { INK_SWATCHES, OUTLINE_CSS_PX } from "./palette";

/**
 * Ink's canvas (T250): the colour word in large type, drawn in its ink inside a thin light outline
 * (T255, see palette.ts), a draining limit bar, and after an answer a tick or a cross with text. The
 * feedback never relies on colour alone.
 */

export type InkColors = Record<Colour, string> & { board: string; outline: string; right: string; wrong: string; bar: string; track: string; text: string };

/** What the last answer showed: right, wrong or too slow, and the ink that was right. */
export type InkFeedback = { result: "right" | "wrong" | "timeout"; answer: Colour };

export type InkFrame = {
  width: number;
  height: number;
  devicePixelRatio: number;
  /** The word on screen, or null between words and during a 3-2-1. */
  word: InkWord | null;
  msSinceWord: number;
  limitMs: number;
  feedback: InkFeedback | null;
  reducedMotion: boolean;
  colors: InkColors;
};

/** How long a new word slides in; reduced motion skips it. */
export const SLIDE_MS = 120;
/** The word's smallest size, in CSS px. */
export const MIN_WORD_PX = 36;
/** The feedback text's size, in CSS px. */
export const FEEDBACK_PX = 28;
/** The longest word (YELLOW) and a generous width per heavy capital, to keep it inside the canvas. */
const LONGEST = 6;
export const EM_PER_LETTER = 0.75;
const PAD = 16;

/** Where the word, the feedback mark and the limit bar go on a `width` x `height` canvas. */
export function wordLayout(width: number, height: number) {
  const fontPx = Math.max(MIN_WORD_PX, Math.min(72, Math.floor((width - 2 * PAD) / (LONGEST * EM_PER_LETTER))));
  const word = { cx: width / 2, cy: height * 0.45, w: LONGEST * EM_PER_LETTER * fontPx, h: fontPx };
  // The mark sits just above the feedback title, so it never overlaps it on a short canvas.
  const size = Math.min(width, height) * 0.2;
  const mark = { cx: width / 2, cy: word.cy - FEEDBACK_PX - size / 2, size };
  const bar = { x: PAD, y: height - PAD - 8, w: width - 2 * PAD, h: 8 };
  return { word, mark, bar, fontPx };
}

/** The share of the word's time limit still left: 1 when it appears, 0 at the limit. */
export const limitFraction = (msSinceWord: number, limitMs: number) => Math.min(1, Math.max(0, 1 - msSinceWord / limitMs));

/** The sideways offset of a word sliding in from the right. */
export const slideOffset = (msSinceWord: number, width: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : (1 - Math.min(1, Math.max(0, msSinceWord / SLIDE_MS))) ** 2 * width * 0.08;

function setFont(ctx: CanvasRenderingContext2D, px: number) {
  ctx.font = `800 ${px}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, px: number, color: string) {
  setFont(ctx, px);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** A tick for a right answer, a cross otherwise. */
function drawMark(ctx: CanvasRenderingContext2D, { cx, cy, size }: { cx: number; cy: number; size: number }, right: boolean, color: string) {
  const s = size / 2;
  ctx.beginPath();
  if (right) {
    ctx.moveTo(cx - s, cy);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.7);
    ctx.lineTo(cx + s, cy - s * 0.7);
  } else {
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx + s, cy + s);
    ctx.moveTo(cx + s, cy - s);
    ctx.lineTo(cx - s, cy + s);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(8, size * 0.12);
  ctx.lineCap = "round";
  ctx.stroke();
}

const FEEDBACK_TITLE = { right: "Right", wrong: "Wrong", timeout: "Too slow" } as const;

export function drawInk(ctx: CanvasRenderingContext2D, frame: InkFrame): void {
  const { width, height, devicePixelRatio, colors, word, feedback } = frame;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, width, height);
  const layout = wordLayout(width, height);
  if (feedback) {
    const right = feedback.result === "right";
    drawMark(ctx, layout.mark, right, right ? colors.right : colors.wrong);
    text(ctx, FEEDBACK_TITLE[feedback.result], layout.word.cx, layout.word.cy, FEEDBACK_PX, colors.text);
    if (!right) text(ctx, `It was ${INK_SWATCHES[feedback.answer].label.toUpperCase()}`, layout.word.cx, layout.word.cy + FEEDBACK_PX * 1.5, FEEDBACK_PX, colors.text);
    return;
  }
  if (!word) return;
  const x = layout.word.cx + slideOffset(frame.msSinceWord, width, frame.reducedMotion);
  const label = word.word.toUpperCase();
  setFont(ctx, layout.fontPx);
  // Stroked first so the fill covers the stroke's inner half and every letter keeps its whole ink.
  // The transform already scales by devicePixelRatio, so this is OUTLINE_CSS_PX x DPR canvas pixels.
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = OUTLINE_CSS_PX;
  ctx.lineJoin = "round";
  ctx.strokeText(label, x, layout.word.cy);
  ctx.fillStyle = colors[word.ink];
  ctx.fillText(label, x, layout.word.cy);
  const { bar } = layout;
  ctx.fillStyle = colors.track;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = colors.bar;
  ctx.fillRect(bar.x, bar.y, bar.w * limitFraction(frame.msSinceWord, frame.limitMs), bar.h);
}
