"use client";

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { GAP_MS, LIVES, play, type FairSplitCut, type FairSplitInputs, type FairSplitOutcome, type FairSplitParams } from "@/challenges/fair-split/engine";
import type { Point } from "@/challenges/fair-split/geometry";
import { boardLayout, drawFairSplit, lineThroughBox, percentLabel, separation, timerFraction, toShape } from "@/challenges/fair-split/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { FAIR_SPLIT_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import styles from "./FairSplitGame.module.css";

/** A drag shorter than this (CSS px) is a stray touch, not a cut. */
export const MIN_DRAG = 24;
/** How strongly the board is tinted while a miss or a timeout shows. */
const MISS_TINT = 0.35;

type Phase = "countdown" | "cut" | "result" | "done";
type Drag = { from: Point; to: Point };

type FairSplitGameProps = {
  params: FairSplitParams;
  onFinish: (inputs: FairSplitInputs) => void;
  /** How long the 3-2-1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/** What the last turn's outcome says, for the screen reader and the line under the board. */
function outcomeText(outcome: FairSplitOutcome | null): string {
  if (!outcome) return "";
  if (outcome.kind === "timeout") return "Time's up. You lose a life.";
  const split = `${percentLabel(outcome.share)} and ${percentLabel(1 - outcome.share)}`;
  return outcome.counted ? `${split}. Fair cut!` : `${split}. Not within 1 point of half: you lose a life.`;
}

/**
 * A Fair Split run: after the 3-2-1, each shape shows with its time ring, and one drag (pointer
 * down to up) across the board cuts it. The split shows for GAP_MS, then the next shape (or the
 * same one after a miss or a timeout). Times are from the end of the 3-2-1, which is when the
 * first shape appears; the engine decides every outcome, timeouts included.
 */
export function FairSplitGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: FairSplitGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const cuts = useRef<FairSplitCut[]>([]);
  const drag = useRef<Drag | null>(null);
  const done = useRef(false);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  const [phase, setPhase] = useState<Phase>(countdownMs > 0 ? "countdown" : "cut");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shapesCut, setShapesCut] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [message, setMessage] = useState("");

  /** Ms since the first shape appeared (negative during the 3-2-1), or null before the first frame. */
  const runMs = (now: number) => (startedAt.current === null ? null : now - startedAt.current - countdownMs);

  /** Brings the screen up to date with the engine at `t` (lives, shapes cut, the message) and reports the run once it ends. */
  const settle = useCallback(
    (t: number) => {
      const state = play(params, { cuts: cuts.current, endMs: t });
      setLives(state.lives);
      setShapesCut(state.shape);
      setMessage(outcomeText(state.last));
      if (state.finished && !done.current) {
        done.current = true;
        setPhase("done");
        finishRef.current({ cuts: cuts.current, endMs: t });
      }
      return state;
    },
    [params],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, FAIR_SPLIT_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const t = now - startedAt.current - countdownMs;
      const number = countdownNumber(now - startedAt.current, countdownMs);
      setCountdown(number);
      const size = fitCanvas(canvas);
      if (number !== null || t < 0) {
        drawFairSplit(ctx, { ...size, polygon: null, drag: null, split: null, timer: null, miss: 0, colors });
        return true;
      }
      const state = done.current ? play(params, { cuts: cuts.current, endMs: t }) : settle(t);
      const { last } = state;
      const showing = last !== null && t < last.atMs + GAP_MS;
      if (!done.current) setPhase(showing ? "result" : "cut");
      if (showing) {
        const polygon = params.shapes[last.shape].polygon;
        const split =
          last.kind === "cut" ? { a: { x: last.cut.ax, y: last.cut.ay }, b: { x: last.cut.bx, y: last.cut.by }, share: last.share, apart: separation(t - last.atMs, reducedRef.current) } : null;
        const missed = last.kind === "timeout" || !last.counted;
        drawFairSplit(ctx, { ...size, polygon, drag: null, split, timer: null, miss: missed ? MISS_TINT : 0, colors });
      } else if (!state.finished) {
        const line = drag.current ? lineThroughBox(drag.current.from, drag.current.to) : null;
        const timer = timerFraction(t - state.appearsAt, params.shapes[state.shape].limitMs);
        drawFairSplit(ctx, { ...size, polygon: params.shapes[state.shape].polygon, drag: line, split: null, timer, miss: 0, colors });
      }
      // Keep drawing until the last split has shown.
      return !state.finished || showing;
    };
    return runFrames(tick);
  }, [params, countdownMs, settle]);

  const pointAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return toShape(boardLayout(rect.width, rect.height), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  // The main button or a touch only, and only while a shape is up.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const t = runMs(performance.now());
    if (event.button !== 0 || t === null || t < 0 || done.current) return;
    const state = play(params, { cuts: cuts.current, endMs: t });
    if (state.finished || t < state.appearsAt) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const at = pointAt(event);
    drag.current = { from: at, to: at };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current) drag.current = { ...drag.current, to: pointAt(event) };
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    const t = runMs(performance.now());
    if (!current || t === null || done.current) return;
    const to = pointAt(event);
    const rect = event.currentTarget.getBoundingClientRect();
    const { scale } = boardLayout(rect.width, rect.height);
    if (Math.hypot(to.x - current.from.x, to.y - current.from.y) * scale < MIN_DRAG) return;
    const line = lineThroughBox(current.from, to);
    const state = play(params, { cuts: cuts.current, endMs: t });
    // Past the deadline the shape has already timed out; the frame loop shows that.
    if (!line || state.deadline === null || t < state.appearsAt || t > state.deadline) return;
    const [a, b] = line;
    cuts.current = [...cuts.current, { atMs: t, ax: a.x, ay: a.y, bx: b.x, by: b.y }];
    setPhase("result");
    settle(t);
  };

  const label =
    phase === "countdown" ? "Get ready." : phase === "cut" ? "Drag one straight cut across the shape." : phase === "result" ? message : "Done.";
  return (
    <div className={styles.game}>
      <div className={styles.status}>
        <p className={styles.count}>
          Shape {Math.min(shapesCut + 1, params.shapes.length)} of {params.shapes.length} · cut {shapesCut}
        </p>
        <span role="img" aria-label={`${lives} of ${LIVES} lives left`} className={styles.lives}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={styles.pip} data-lost={i >= lives || undefined} />
          ))}
        </span>
      </div>
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.board}
          data-phase={phase}
          role="img"
          aria-label={label}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
        />
        {countdown !== null && <CountdownNumber key={countdown} value={countdown} />}
      </div>
      <p className={styles.hint} aria-live="polite">
        {message || "Drag a straight line to cut the shape in half."}
      </p>
    </div>
  );
}
