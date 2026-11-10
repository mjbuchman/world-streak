"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TAPS, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";
import { drawStacking, FALL_MS, type StackingColors } from "@/challenges/stacking/render";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { CHALLENGE_NAMES } from "@/config/challenges";
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

/** Reads the Fresh Sport colour tokens, so the canvas matches the rest of the page. */
function themeColors(element: HTMLElement): StackingColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(`--fs-color-${name}`).trim();
  return {
    empty: token("surface-strong"),
    tower: token("mint"),
    moving: token("tangerine"),
    falling: token("mint-dark"),
    target: token("mint-light"),
  };
}

/**
 * Runs one stacking game from the moment it mounts. Taps (pointer presses on the canvas, or
 * Space) are stamped with the elapsed ms of the input event; every animation frame replays
 * them through the engine and draws the result.
 */
export function StackingGame({ params, onFinish, passTarget: target, best = 0 }: Props) {
  // pass_target is numeric; a fractional target (say 10.5) means reaching row 11.
  const passTarget = target === undefined ? undefined : Math.ceil(target);
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

    // The engine (and the server, for scored runs) only accepts strictly increasing taps, at
    // most MAX_TAPS of them. Browsers round performance.now() to about 1 ms, so two inputs in
    // the same moment (a two-finger touch, a click plus Space) would otherwise stamp twice.
    const tap = () => {
      const at = performance.now() - start;
      const last = taps.at(-1);
      if (finished || taps.length >= MAX_TAPS) return;
      if (last !== undefined && at <= last) return;
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
