"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { LIVES, play, sequenceFor, type EchoPathInputs, type EchoPathParams } from "@/challenges/echo-path/engine";
import { boardLayout, drawEchoPath, hitTile, litTileAt, missStrength, playbackMs } from "@/challenges/echo-path/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { ECHO_PATH_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import styles from "./EchoPathGame.module.css";

/** The pause after a clear or a miss before the next playback starts. */
export const BETWEEN_MS = 700;
/** How long a pressed tile stays highlighted. */
export const PRESS_MS = 150;

type Phase = "countdown" | "watch" | "repeat" | "done";
type Showing = { startsAt: number; sequence: number[] };

type EchoPathGameProps = {
  params: EchoPathParams;
  onFinish: (inputs: EchoPathInputs) => void;
  /** How long the 3-2-1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * An Echo Path run: after the 3-2-1, each sequence plays back on the grid (by elapsed time), then
 * the player taps it back. Taps during the playback are ignored. A clear or a miss pauses for
 * BETWEEN_MS, then the next sequence plays (longer after a clear, new after a miss). Taps are
 * timed from the first frame on screen.
 */
export function EchoPathGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: EchoPathGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const taps = useRef<EchoPathInputs["taps"]>([]);
  const showing = useRef<Showing | null>(null);
  const pressed = useRef<{ tile: number; at: number } | null>(null);
  const missedAt = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  const [phase, setPhase] = useState<Phase>(countdownMs > 0 ? "countdown" : "watch");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [state, setState] = useState(() => play(params, { taps: [] }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, ECHO_PATH_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const number = countdownNumber(now - startedAt.current, countdownMs);
      setCountdown(number);
      // The first playback starts right after "1".
      if (number === null) showing.current ??= { startsAt: now, sequence: sequenceFor(params, params.startLength, 0) };
      const current = showing.current;
      const since = current ? now - current.startsAt : -1;
      const over = taps.current.length > 0 && play(params, { taps: taps.current }).finished;
      if (number !== null) setPhase("countdown");
      else if (!over) setPhase(current && since >= playbackMs(current.sequence.length, params.stepMs) ? "repeat" : "watch");
      const press = pressed.current && now - pressed.current.at < PRESS_MS ? pressed.current.tile : null;
      drawEchoPath(ctx, {
        cols: params.cols,
        rows: params.rows,
        ...fitCanvas(canvas),
        lit: current ? litTileAt(current.sequence, params.stepMs, since) : null,
        pressed: press,
        miss: missStrength(missedAt.current === null ? null : now - missedAt.current, reducedRef.current),
        colors,
      });
      // Keep drawing until the last press and miss have faded.
      return !over || press !== null || missStrength(missedAt.current === null ? null : now - missedAt.current, false) > 0;
    };
    return runFrames(tick);
  }, [params, countdownMs]);

  const tapTile = (tile: number) => {
    const current = showing.current;
    const now = performance.now();
    if (!current || startedAt.current === null) return;
    // During the playback, and the pause before it, taps do not count.
    if (now - current.startsAt < playbackMs(current.sequence.length, params.stepMs)) return;
    const before = play(params, { taps: taps.current });
    if (before.finished) return;
    taps.current = [...taps.current, { tile, atMs: now - startedAt.current }];
    const after = play(params, { taps: taps.current });
    pressed.current = { tile, at: now };
    setState(after);
    if (after.lives < before.lives) missedAt.current = now;
    if (after.finished) {
      setPhase("done");
      finishRef.current({ taps: taps.current });
    } else if (after.position === 0) {
      showing.current = { startsAt: now + BETWEEN_MS, sequence: sequenceFor(params, after.length, after.tryIndex) };
      setPhase("watch");
    }
  };

  // The main button or a touch only: a right-click is not a tap.
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (event.button !== 0 || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tile = hitTile(boardLayout(rect.width, rect.height, params.cols, params.rows), event.clientX - rect.left, event.clientY - rect.top);
    if (tile !== null) tapTile(tile);
  };

  // Keys 1 to 9 tap the tiles row by row, as on a phone keypad read from the top.
  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const tile = Number(event.key) - 1;
    if (event.repeat || !Number.isInteger(tile) || tile < 0 || tile >= params.cols * params.rows) return;
    event.preventDefault();
    tapTile(tile);
  };

  const label =
    phase === "countdown" ? "Get ready." : phase === "watch" ? "Watch the tiles light up." : phase === "repeat" ? "Tap the tiles in the same order." : "Done.";
  return (
    <div className={styles.game}>
      <div className={styles.status}>
        <p className={styles.length}>
          Length {Math.min(state.length, params.maxLength)} · best {state.longest}
        </p>
        <span role="img" aria-label={`${state.lives} of ${LIVES} lives left`} className={styles.lives}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={styles.pip} data-lost={i >= state.lives || undefined} />
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
          tabIndex={0}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />
        {countdown !== null && <CountdownNumber key={countdown} value={countdown} />}
      </div>
      <p className={styles.hint}>Tap the tiles, or press 1 to 9 for them row by row.</p>
    </div>
  );
}
