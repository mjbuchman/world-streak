"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  play,
  ROUND_COUNTDOWN_MS,
  SHOW_MS,
  type FairSplitCut,
  type FairSplitInputs,
  type FairSplitOutcome,
  type FairSplitParams,
} from "@/challenges/fair-split/engine";
import type { Point } from "@/challenges/fair-split/geometry";
import {
  boardLayout,
  drawFairSplit,
  hitLine,
  initialLine,
  moveHandle,
  nudge,
  percentLabel,
  separation,
  timerFraction,
  toShape,
  translateLine,
  type Line,
} from "@/challenges/fair-split/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { FAIR_SPLIT_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { Button } from "@/components/ui/Button";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import styles from "./FairSplitGame.module.css";

/** How strongly the board is tinted while a cut that busted the bank shows. */
const MISS_TINT = 0.35;

type Phase = "countdown" | "cut" | "result" | "done";
/** What a pointer is moving: one end of the line, or all of it from where it last was. */
type Grab = { which: "a" | "b" | "body"; last: Point };

/** Points to 2 decimals, without trailing zeros ("0.8 points", "1 point"): the bank's reading. */
export const points = (value: number) => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${rounded === 1 ? "point" : "points"}`;
};

/** What the last shape's outcome says, for the screen reader and the line under the board. */
function outcomeText(outcome: FairSplitOutcome | null): string {
  if (!outcome) return "";
  if (outcome.kind === "timeout") return "Time's up.";
  const split = `${percentLabel(outcome.share)} and ${percentLabel(1 - outcome.share)}`;
  const off = outcome.cost === 0 ? "Right on half." : `${points(outcome.cost)} off half.`;
  return outcome.survived ? `${split}. ${off}` : `${split}. ${off} More than the bank had left.`;
}

/**
 * A Fair Split run (T195): before every shape a "Round N" 3-2-1, then the shape with a line across
 * it. Dragging the line's ends or its body, or the arrow and [ ] keys, place it; Cut or Enter cuts
 * once. At the time limit the line is cut where it is. The pieces show for SHOW_MS, then the next
 * round. One frame loop on one clock from the game's start draws all of it, the 3-2-1s included,
 * so the screen and the engine always agree on when a shape is up (DECISIONS, T195).
 */
export function FairSplitGame({ params, onFinish }: { params: FairSplitParams; onFinish: (inputs: FairSplitInputs) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const cuts = useRef<FairSplitCut[]>([]);
  const line = useRef<{ round: number; line: Line }>({ round: 0, line: initialLine() });
  const grab = useRef<Grab | null>(null);
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

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [costs, setCosts] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");

  /** Ms since the game started, or null before its first frame. */
  const clockAt = (now: number) => (startedAt.current === null ? null : now - startedAt.current);
  const stateAt = useCallback((t: number) => play(params, { cuts: cuts.current, endMs: t }), [params]);

  /** The line for `round`: a fresh one for each new shape. */
  const lineFor = (forRound: number) => {
    if (line.current.round !== forRound) line.current = { round: forRound, line: initialLine() };
    return line.current.line;
  };

  /** True while the shape is up and can still be cut. */
  const canCut = (t: number | null): t is number => {
    if (t === null || done.current) return false;
    const state = stateAt(t);
    return state.deadline !== null && t >= state.appearsAt && t <= state.deadline;
  };

  const cutAt = useCallback(
    (t: number) => {
      const state = stateAt(t);
      const [a, b] = lineFor(state.round);
      cuts.current = [...cuts.current, { atMs: t, ax: a.x, ay: a.y, bx: b.x, by: b.y }];
      grab.current = null;
    },
    [stateAt],
  );

  /** Brings the round, the bank and the message up to date with the engine at `t`. */
  const settle = useCallback(
    (t: number) => {
      const state = stateAt(t);
      setRound(state.round);
      setCosts((previous) => (previous.length === state.costs.length ? previous : state.costs));
      setFailed(state.failed);
      setMessage(outcomeText(state.last));
      return state;
    },
    [stateAt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, FAIR_SPLIT_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const t = now - startedAt.current;
      // At the limit the line is cut where it is, at the deadline itself, however late this frame is.
      const before = stateAt(cuts.current.at(-1)?.atMs ?? 0);
      if (!done.current && before.deadline !== null && t >= before.deadline) cutAt(before.deadline);
      const state = settle(t);
      const size = fitCanvas(canvas);
      const { last } = state;
      if (last !== null && t < last.atMs + SHOW_MS) {
        setPhase("result");
        setCountdown(null);
        const split =
          last.kind === "cut" ? { a: { x: last.cut.ax, y: last.cut.ay }, b: { x: last.cut.bx, y: last.cut.by }, share: last.share, apart: separation(t - last.atMs, reducedRef.current) } : null;
        const busted = last.kind === "timeout" || !last.survived;
        drawFairSplit(ctx, { ...size, polygon: params.shapes[last.shape].polygon, line: null, split, timer: null, miss: busted ? MISS_TINT : 0, colors });
        return true;
      }
      if (state.finished) {
        // The run ends once its last pieces have shown, so a phone's click after the tap lands here, not on the result.
        if (!done.current && last !== null) {
          done.current = true;
          setPhase("done");
          finishRef.current({ cuts: cuts.current, endMs: last.atMs });
        }
        return false;
      }
      if (t < state.appearsAt) {
        setPhase("countdown");
        setCountdown(countdownNumber(t - (state.appearsAt - ROUND_COUNTDOWN_MS), ROUND_COUNTDOWN_MS));
        drawFairSplit(ctx, { ...size, polygon: null, line: null, split: null, timer: null, miss: 0, colors });
        return true;
      }
      setPhase("cut");
      setCountdown(null);
      const shape = params.shapes[state.round];
      const timer = timerFraction(t - state.appearsAt, shape.limitMs);
      drawFairSplit(ctx, { ...size, polygon: shape.polygon, line: lineFor(state.round), split: null, timer, miss: 0, colors });
      return true;
    };
    return runFrames(tick);
  }, [params, stateAt, cutAt, settle]);

  const commit = () => {
    const t = clockAt(performance.now());
    if (!canCut(t)) return;
    cutAt(t);
    settle(t);
    setPhase("result");
  };

  const pointAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const layout = boardLayout(rect.width, rect.height);
    return { layout, x, y, shape: toShape(layout, { x, y }) };
  };

  // The main button or a touch only, on the line, and only while a shape is up. Letting go never cuts.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const t = clockAt(performance.now());
    if (event.button !== 0 || !canCut(t)) return;
    const { layout, x, y, shape } = pointAt(event);
    const which = hitLine(layout, lineFor(stateAt(t).round), x, y);
    if (!which) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    grab.current = { which, last: shape };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const held = grab.current;
    if (!held) return;
    const { shape } = pointAt(event);
    const current = line.current.line;
    const moved =
      held.which === "body" ? translateLine(current, { x: shape.x - held.last.x, y: shape.y - held.last.y }) : moveHandle(current, held.which, shape);
    line.current = { ...line.current, line: moved };
    grab.current = { ...held, last: shape };
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const t = clockAt(performance.now());
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (!canCut(t)) return;
    const moved = nudge(lineFor(stateAt(t).round), event.key);
    if (!moved) return;
    event.preventDefault();
    line.current = { ...line.current, line: moved };
  };

  const total = params.shapes.length;
  const label =
    phase === "countdown"
      ? `Round ${round + 1}. Get ready.`
      : phase === "cut"
        ? "Place the line across the shape so it cuts it in half, then press Cut."
        : phase === "result"
          ? message
          : "Done.";
  return (
    <div className={styles.game}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={total} current={round} failedRound={failed ? round : undefined} />
      <BankGauge total={params.bank} spent={costs} format={points} label="Split bank" />
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.board}
          data-phase={phase}
          role="img"
          tabIndex={0}
          aria-label={label}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (grab.current = null)}
          onPointerCancel={() => (grab.current = null)}
          onKeyDown={onKeyDown}
        />
        {countdown !== null && (
          <>
            <p className={styles.caption}>Round {round + 1}</p>
            <CountdownNumber key={countdown} value={countdown} />
          </>
        )}
      </div>
      <div className={styles.actions}>
        <Button onClick={commit} disabled={phase !== "cut"}>
          Cut
        </Button>
      </div>
      <p className={styles.hint} aria-live="polite">
        {phase === "result" ? message : "Drag the line's ends or the line itself. Arrow keys slide it, [ and ] turn it, Enter cuts."}
      </p>
    </div>
  );
}
