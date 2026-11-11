"use client";

import { type KeyboardEvent, useEffect, useRef } from "react";
import type { InnerClockInputs, InnerClockParams } from "@/challenges/inner-clock/engine";
import styles from "./InnerClockGame.module.css";

/** "5 seconds"; targets are whole multiples of 100 ms, so at most one decimal. */
export function targetLabel(targetMs: number): string {
  const seconds = targetMs / 1000;
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

type InnerClockGameProps = { params: InnerClockParams; onFinish: (inputs: InnerClockInputs) => void };

/**
 * A Second Sense run: one big tap area and nothing that shows the time. The clock starts in the
 * first frame after the run is on screen (what the player sees as the start), and the run ends
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

  useEffect(() => {
    areaRef.current?.focus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      startedAt.current = performance.now();
      timer = setTimeout(() => {
        if (done.current) return;
        done.current = true;
        finishRef.current({ tapMs: null });
      }, params.timeoutMs);
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
      <span className={styles.prompt}>Tap when you think {targetLabel(params.targetMs)} have passed</span>
      <span className={styles.hint}>Tap, click or press Space</span>
    </button>
  );
}
