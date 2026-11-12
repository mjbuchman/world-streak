"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TAPS, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";
import { drawStacking, FALL_MS, type StackingColors } from "@/challenges/stacking/render";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { CANVAS_COLOR_TOKENS } from "./canvasTokens";
import { targetRowNumber } from "./rows";
import styles from "./StackingGame.module.css";
import { frameAt } from "./stackingLoop";

export type FinishedRun = { taps: number[]; result: StackingResult };

type Props = {
  params: StackingParams;
  onFinish: (run: FinishedRun) => void;
  /** Today's pass row on /play: shown in the HUD and drawn as a line. */
  passTarget?: number;
  /** The best row reached earlier in this visit, shown in practice. */
  best?: number;
};

/** Reads the colour tokens, so the canvas matches the rest of the page. */
function themeColors(element: HTMLElement): StackingColors {
  const style = getComputedStyle(element);
  const entries = Object.entries(CANVAS_COLOR_TOKENS).map(([key, token]) => [key, style.getPropertyValue(token).trim()]);
  return Object.fromEntries(entries) as StackingColors;
}

/**
 * Runs one stacking game from the moment it mounts. Taps (pointer presses on the canvas, or
 * Space) are stamped with the elapsed ms of the input event; every animation frame replays
 * them through the engine and draws the result.
 */
export function StackingGame({ params, onFinish, passTarget: target, best = 0 }: Props) {
  const passTarget = target === undefined ? undefined : targetRowNumber(target);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [row, setRow] = useState(1);
  const reducedMotion = usePrefersReducedMotion();
  // The latest values, read by the frame loop, so a parent re-render never restarts the run.
  const latest = useRef({ onFinish, passTarget, reducedMotion });
  useEffect(() => {
    latest.current = { onFinish, passTarget, reducedMotion };
  }, [onFinish, passTarget, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // The button that started the run has just gone, so take focus instead of leaving it on <body>.
    canvas.focus({ preventScroll: true });
    const start = performance.now();
    const taps: number[] = [];
    const colors = themeColors(canvas);
    let finished = false;
    // Set when the run ends: the run as it ended, and when, so the last fall can play out.
    let ended: { run: FinishedRun; atMs: number } | null = null;
    let frameId = 0;

    // While the run is going, record only taps the engine counts: each must come after the row
    // in play appeared (row 1 at 0 ms, then each row at the previous tap), at most MAX_TAPS of
    // them. A tap the engine would ignore must not be recorded, or it would use up the last
    // row's tap and, with no time limit, the run could never end. (A tap in the moment between
    // the run ending and the next frame is recorded; the engine ignores taps after the end.)
    // Browsers round performance.now() (to 1 ms, or far coarser with fingerprinting
    // protection), so two inputs in one moment, or a press as the run starts, stamp the same
    // time.
    const tap = () => {
      const at = performance.now() - start;
      if (finished || taps.length >= MAX_TAPS) return;
      if (at <= (taps.at(-1) ?? 0)) return;
      taps.push(at);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault(); // Space would otherwise scroll the page
      tap();
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      if (event.isPrimary === false) return; // a second finger is not a second tap
      tap();
    };

    const frame = () => {
      const elapsedMs = performance.now() - start;
      const { result, finished: done } = frameAt(params, taps, elapsedMs);
      const { width, height } = canvas.getBoundingClientRect();
      const devicePixelRatio = window.devicePixelRatio || 1;
      // Resizing clears the backing store, so only do it when the size actually changes.
      const pixelWidth = Math.round(width * devicePixelRatio);
      const pixelHeight = Math.round(height * devicePixelRatio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const { passTarget, reducedMotion } = latest.current;
      drawStacking(ctx, { params, result, elapsedMs, width, height, devicePixelRatio, colors, passTarget, reducedMotion });
      setRow(result.moving?.row ?? result.score);
      if (done && !ended) {
        // Taps stop counting now; the result is fixed.
        finished = true;
        ended = { run: { taps: [...taps], result }, atMs: elapsedMs };
      }
      // Keep drawing until the missed cells have fallen away (nothing to watch under reduced
      // motion), then hand over the run as it ended.
      if (ended && (reducedMotion || elapsedMs - ended.atMs >= FALL_MS)) {
        latest.current.onFinish(ended.run);
        return;
      }
      frameId = requestAnimationFrame(frame);
    };

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    frameId = requestAnimationFrame(frame);
    return () => {
      finished = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, [params]);

  return (
    // data-game-running lets the page hide its back button and the header while the run is on.
    <div className={styles.game} data-game-running="">
      <div className={styles.hud}>
        <p role="status" className={styles.count}>
          {`Row ${row}`}
        </p>
        {passTarget !== undefined ? (
          <p className={styles.goal}>{`Row ${passTarget} to pass`}</p>
        ) : (
          best > 0 && <p className={styles.goal}>{`Best: row ${best}`}</p>
        )}
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={-1}
        className={styles.canvas}
        role="img"
        aria-label={`${CHALLENGE_NAMES.stacking} game area. Tap, click or press Space to lock the moving row.`}
      />
    </div>
  );
}
