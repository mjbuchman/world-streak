"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { type InnerClockInputs, type InnerClockParams, REVEAL_MS } from "@/challenges/inner-clock/engine";
import styles from "./InnerClockGame.module.css";

/** "5 seconds"; targets are whole multiples of 100 ms, so at most one decimal. */
export function targetLabel(targetMs: number): string {
  const seconds = targetMs / 1000;
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

/** "0.5": whole tenths of a second, rounded down, as a stopwatch shows them. */
const clockLabel = (ms: number) => (Math.floor(ms / 100) / 10).toFixed(1);

type InnerClockGameProps = { params: InnerClockParams; onFinish: (inputs: InnerClockInputs) => void };

/**
 * A Second Sense run: one big tap area, with a running clock for the first REVEAL_MS only (an
 * exact starting point; M3 play-test). The clock starts in the first frame after the run is on
 * screen (what the player sees as the start), and the run ends
 * with the first tap (pointer, Space or Enter) or at the timeout with no tap.
 */
export function InnerClockGame({ params, onFinish }: InnerClockGameProps) {
  const areaRef = useRef<HTMLButtonElement>(null);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  // The latest callback, so the effect below runs once per run rather than per render.
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  // The clock shown for the first REVEAL_MS, in ms from the start; null once it has hidden.
  const [shownMs, setShownMs] = useState<number | null>(0);

  useEffect(() => {
    areaRef.current?.focus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    // Each frame until the reveal ends moves the shown clock on.
    const tick = () => {
      const elapsed = performance.now() - startedAt.current!;
      if (elapsed >= REVEAL_MS) {
        setShownMs(null);
        return;
      }
      setShownMs(elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(() => {
      startedAt.current = performance.now();
      timer = setTimeout(() => {
        if (done.current) return;
        done.current = true;
        finishRef.current({ tapMs: null });
      }, params.timeoutMs);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [params.timeoutMs]);

  const tap = () => {
    if (done.current || startedAt.current === null) return;
    done.current = true;
    finishRef.current({ tapMs: performance.now() - startedAt.current });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    // Keep Space from scrolling and Enter from also firing a click.
    event.preventDefault();
    tap();
  };

  return (
    <button
      ref={areaRef}
      type="button"
      className={styles.area}
      // The main button or a touch only: a right-click is not a tap.
      onPointerDown={(event) => event.button === 0 && tap()}
      onKeyDown={onKeyDown}
    >
      {/* Hidden from screen readers: read every frame it would drown out the prompt. */}
      <span className={styles.clock} data-clock={shownMs === null ? "hidden" : "shown"} aria-hidden="true">
        {shownMs === null ? "" : clockLabel(shownMs)}
      </span>
      <span className={styles.prompt}>Tap when you think {targetLabel(params.targetMs)} have passed</span>
      <span className={styles.hint}>Tap, click or press Space</span>
    </button>
  );
}
