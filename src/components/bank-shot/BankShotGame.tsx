"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { flight, play, ROUND_COUNTDOWN_MS, SHOW_MS, type BankShotInputs, type BankShotOutcome, type BankShotParams, type BankShotTap } from "@/challenges/bank-shot/engine";
import { BOARD_W } from "@/challenges/bank-shot/geometry";
import { boardLayout, drawBankShot, markerX, unitsLabel } from "@/challenges/bank-shot/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { BANK_SHOT_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { Button } from "@/components/ui/Button";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import styles from "./BankShotGame.module.css";

/** How strongly the board is tinted while a miss that busted the bank shows. */
const MISS_TINT = 0.35;

type Phase = "countdown" | "glimpse" | "aim" | "result" | "done";

/** Board units to one decimal ("13.5"): the bank's reading. */
export const oneDecimal = (value: number) => `${Math.round(value * 10) / 10}`;

/** What the last round's outcome says, for the screen reader and the line under the board. */
function outcomeText(outcome: BankShotOutcome | null): string {
  if (!outcome) return "";
  if (outcome.kind === "timeout") return "Time's up.";
  const off = outcome.cost === 0 ? "Right on the crossing." : `${unitsLabel(outcome.cost)} off.`;
  return outcome.survived ? off : `${off} More than the bank had left.`;
}

/**
 * A Bank Shot run (T233): before every round a "Round N" 3-2-1, then the puck's launch and a short
 * glimpse of it bouncing up the board. Once it vanishes, a tap or drag anywhere on the board puts
 * the marker on the finish line straight above it (it can be moved again), and Lock in or Enter
 * commits the guess. The real path shows for SHOW_MS, then the next round. One frame loop on one
 * clock from the game's start draws all of it, so the screen and the engine agree on every timing.
 */
export function BankShotGame({ params, onFinish }: { params: BankShotParams; onFinish: (inputs: BankShotInputs) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const taps = useRef<BankShotTap[]>([]);
  const marker = useRef<{ round: number; x: number | null }>({ round: 0, x: null });
  const dragging = useRef(false);
  /** Each round's launch, kept so its bumper keeps turning on the same clock during the reveal. */
  const launches = useRef<number[]>([]);
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
  const [placed, setPlaced] = useState(false);

  const clockAt = (now: number) => (startedAt.current === null ? null : now - startedAt.current);
  const stateAt = useCallback((t: number) => play(params, { taps: taps.current, endMs: t }), [params]);

  /** The marker for `forRound`: none yet on a new round. */
  const markerFor = (forRound: number) => {
    if (marker.current.round !== forRound) marker.current = { round: forRound, x: null };
    return marker.current.x;
  };
  const setMarker = (forRound: number, x: number) => {
    marker.current = { round: forRound, x: Math.min(BOARD_W, Math.max(0, x)) };
    setPlaced(true);
  };

  /** The round's state at `t` if the puck has vanished and the guess can still be locked, else null. */
  const aiming = (t: number | null) => {
    if (t === null || done.current) return null;
    const state = stateAt(t);
    const inWindow = state.glimpseEnd !== null && state.deadline !== null && t >= state.glimpseEnd && t <= state.deadline;
    const showing = state.last !== null && t < state.last.atMs + SHOW_MS;
    return inWindow && !showing ? state : null;
  };

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
    const colors = readColorTokens(canvas, BANK_SHOT_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const t = now - startedAt.current;
      const state = settle(t);
      const size = fitCanvas(canvas);
      const base = { ...size, params, reducedMotion: reducedRef.current, colors };
      const { last } = state;
      if (last !== null && t < last.atMs + SHOW_MS) {
        setPhase("result");
        setCountdown(null);
        const reveal =
          last.kind === "tap" ? { crossingX: last.crossingX, miss: last.cost } : { crossingX: flight(params.rounds[last.round]).crossing.x, miss: null };
        const busted = last.kind === "timeout" || !last.survived;
        const msSinceLaunch = t - (launches.current[last.round] ?? t);
        drawBankShot(ctx, { ...base, round: last.round, msSinceLaunch, marker: last.kind === "tap" ? last.x : null, reveal, missTint: busted ? MISS_TINT : 0 });
        return true;
      }
      if (state.finished) {
        // The run ends once its last reveal has shown, so a phone's click after the tap lands here.
        if (!done.current && last !== null) {
          done.current = true;
          setPhase("done");
          finishRef.current({ taps: taps.current, endMs: last.atMs + SHOW_MS });
        }
        return false;
      }
      launches.current[state.round] = state.launchAt;
      const msSinceLaunch = t - state.launchAt;
      if (t < state.launchAt) {
        setPhase("countdown");
        setCountdown(countdownNumber(t - (state.launchAt - ROUND_COUNTDOWN_MS), ROUND_COUNTDOWN_MS));
        drawBankShot(ctx, { ...base, round: null, msSinceLaunch, marker: null, reveal: null, missTint: 0 });
        return true;
      }
      setCountdown(null);
      setPhase(state.glimpseEnd !== null && t < state.glimpseEnd ? "glimpse" : "aim");
      drawBankShot(ctx, { ...base, round: state.round, msSinceLaunch, marker: markerFor(state.round), reveal: null, missTint: 0 });
      return true;
    };
    return runFrames(tick);
  }, [params, settle]);

  const lockIn = () => {
    const t = clockAt(performance.now());
    const state = aiming(t);
    if (!state || t === null) return;
    const x = markerFor(state.round);
    if (x === null) return;
    taps.current = [...taps.current, { round: state.round, atMs: t, x }];
    dragging.current = false;
    setPlaced(false);
    settle(t);
    setPhase("result");
  };

  const placeAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = aiming(clockAt(performance.now()));
    if (!state) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    setMarker(state.round, markerX(boardLayout(rect.width, rect.height), event.clientX - rect.left));
    return true;
  };

  // The main button or a touch only, and only once the puck has vanished. Letting go never locks.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !placeAt(event)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragging.current) placeAt(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      lockIn();
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const state = aiming(clockAt(performance.now()));
    if (!state) return;
    event.preventDefault();
    const step = (event.shiftKey ? 5 : 1) * (event.key === "ArrowLeft" ? -1 : 1);
    setMarker(state.round, (markerFor(state.round) ?? BOARD_W / 2) + step);
  };

  const total = params.rounds.length;
  const label =
    phase === "countdown"
      ? `Round ${round + 1}. Get ready.`
      : phase === "glimpse"
        ? "Watch the puck bounce up the board."
        : phase === "aim"
          ? "Tap where the puck will cross the finish line, then press Lock in."
          : phase === "result"
            ? message
            : "Done.";
  return (
    <div className={styles.game}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={total} current={round} failedRound={failed ? round : undefined} />
      <BankGauge total={params.bank} spent={costs} format={oneDecimal} label="Distance bank" />
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
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
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
        <Button onClick={lockIn} disabled={phase !== "aim" || !placed}>
          Lock in
        </Button>
      </div>
      <p className={styles.hint} aria-live="polite">
        {phase === "result" ? message : "Tap the board to place your marker. Arrow keys move it (Shift for 5), Enter locks in."}
      </p>
    </div>
  );
}
