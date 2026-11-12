"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { type InnerClockInputs, type InnerClockParams, REVEAL_MS } from "@/challenges/inner-clock/engine";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import styles from "./InnerClockGame.module.css";

/** "5 seconds"; targets are whole multiples of 100 ms, so at most one decimal. */
export function targetLabel(targetMs: number): string {
  const seconds = targetMs / 1000;
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

/** "0.5": whole tenths of a second, rounded down, as a stopwatch shows them. */
const clockLabel = (ms: number) => (Math.floor(ms / 100) / 10).toFixed(1);

/** After the first second the clock stops and fades out over this long (T118), or just goes with reduced motion. */
export const CLOCK_FADE_MS = 400;

type ClockState = { phase: "shown"; ms: number } | { phase: "fading" } | { phase: "hidden" };

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

  // The clock: running for the first REVEAL_MS, then stopped at the reveal and fading, then gone.
  const [clockState, setClockState] = useState<ClockState>({ phase: "shown", ms: 0 });
  // Read in the frame loop, which must not restart when the preference arrives after hydration.
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  useEffect(() => {
    areaRef.current?.focus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    // Each frame moves the clock on, until it has faded (elapsed time, not frames, decides).
    const tick = () => {
      const elapsed = performance.now() - startedAt.current!;
      if (elapsed < REVEAL_MS) {
        setClockState({ phase: "shown", ms: elapsed });
      } else if (!reducedRef.current && elapsed < REVEAL_MS + CLOCK_FADE_MS) {
        setClockState({ phase: "fading" });
      } else {
        setClockState({ phase: "hidden" });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const timeOut = () => {
      if (done.current) return;
      done.current = true;
      finishRef.current({ tapMs: null });
    };
    // The clock keeps running while the tab is hidden (T110), but a hidden tab's timer can fire
    // late, so on return a run already past its timeout ends at once.
    const onVisibilityChange = () => {
      if (document.hidden || startedAt.current === null) return;
      if (performance.now() - startedAt.current >= params.timeoutMs) timeOut();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    frame = requestAnimationFrame(() => {
      startedAt.current = performance.now();
      timer = setTimeout(timeOut, params.timeoutMs);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
      <span className={styles.clock} data-clock={clockState.phase} aria-hidden="true">
        {clockState.phase === "shown" ? clockLabel(clockState.ms) : clockState.phase === "fading" ? clockLabel(REVEAL_MS) : ""}
      </span>
      <span className={styles.prompt}>Tap when you think {targetLabel(params.targetMs)} have passed</span>
      <span className={styles.hint}>Tap, click or press Space</span>
    </button>
  );
}
