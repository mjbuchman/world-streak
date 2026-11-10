"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TAPS, type StackingParams, type StackingResult } from "@/challenges/stacking/engine";
import { drawStacking, type StackingColors } from "@/challenges/stacking/render";
import { CHALLENGE_NAMES } from "@/config/challenges";
import styles from "./StackingGame.module.css";
import { frameAt } from "./stackingLoop";

export type FinishedRun = { taps: number[]; result: StackingResult };

type Props = { params: StackingParams; onFinish: (run: FinishedRun) => void };

/** Reads the Fresh Sport colour tokens, so the canvas matches the rest of the page. */
function themeColors(element: HTMLElement): StackingColors {
  const style = getComputedStyle(element);
  const token = (name: string) => style.getPropertyValue(`--fs-color-${name}`).trim();
  return { empty: token("surface-strong"), tower: token("mint"), moving: token("tangerine") };
}

/**
 * Runs one stacking game from the moment it mounts. Taps (pointer presses on the canvas, or
 * Space) are stamped with the elapsed ms of the input event; every animation frame replays
 * them through the engine and draws the result.
 */
export function StackingGame({ params, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [blocks, setBlocks] = useState(0);
  // The latest callback, so a parent re-render never restarts the run.
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

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
      drawStacking(ctx, { params, result, elapsedMs, width, height, devicePixelRatio, colors });
      setBlocks(result.score);
      if (done) {
        finished = true;
        onFinishRef.current({ taps: [...taps], result });
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
    // data-game-running lets the page shell hide its back button while the run is on.
    <div className={styles.game} data-game-running="">
      <p role="status" className={styles.count}>
        Blocks: {blocks}
      </p>
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
