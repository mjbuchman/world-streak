"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { type InnerClockInputs, type InnerClockParams, REVEAL_MS } from "@/challenges/inner-clock/engine";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import { COUNTDOWN_FROM, RUN_COUNTDOWN_MS } from "@/config/countdown";
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

type ClockState = { phase: "countdown"; number: number } | { phase: "shown"; ms: number } | { phase: "fading" } | { phase: "hidden" };

type InnerClockGameProps = {
  params: InnerClockParams;
  onFinish: (inputs: InnerClockInputs) => void;
  /** How long the 3-2-1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Second Sense run: one big tap area, with a running clock for the first REVEAL_MS only (an
 * exact starting point; M3 play-test). A 3-2-1 counts from the first frame after the run is on
 * screen (T138); the clock starts right after "1" (what the player sees as the start), and the
 * run ends with the first tap after that (pointer, Space or Enter) or at the timeout with no tap.
 */
export function InnerClockGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: InnerClockGameProps) {
  const areaRef = useRef<HTMLButtonElement>(null);
  const startedAt = useRef<number | null>(null);
  const done = useRef(false);
  // The latest callback, so the effect below runs once per run rather than per render.
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });

  // The clock: the countdown in its place, then running for the first REVEAL_MS, then stopped at
  // the reveal and fading, then gone.
  const [clockState, setClockState] = useState<ClockState>(() =>
    countdownMs > 0 ? { phase: "countdown", number: COUNTDOWN_FROM } : { phase: "shown", ms: 0 },
  );
  // Read in the frame loop, which must not restart when the preference arrives after hydration.
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  useEffect(() => {
    areaRef.current?.focus();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // This effect's own start; the ref is what tap() reads, and outlives a re-run of the effect.
    let start: number | null = null;
    let shownAt: number | null = null;
    // The first frame starts the countdown and the first one after it the run; each later one
    // moves the clock on, until it has faded (elapsed time, not frames, decides).
    const tick = (now: number) => {
      if (start === null) {
        shownAt ??= now;
        const number = countdownNumber(now - shownAt, countdownMs);
        if (number !== null) {
          setClockState({ phase: "countdown", number });
          return true;
        }
        start = startedAt.current = now;
        timer = setTimeout(timeOut, params.timeoutMs);
        setClockState({ phase: "shown", ms: 0 });
        return true;
      }
      const elapsed = now - start;
      if (elapsed < REVEAL_MS) {
        setClockState({ phase: "shown", ms: elapsed });
      } else if (!reducedRef.current && elapsed < REVEAL_MS + CLOCK_FADE_MS) {
        setClockState({ phase: "fading" });
      } else {
        setClockState({ phase: "hidden" });
        return false;
      }
      return true;
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
    const stop = runFrames(tick);
    return () => {
      stop();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [params.timeoutMs, countdownMs]);

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
        {clockState.phase === "countdown" ? (
          <CountdownNumber key={clockState.number} value={clockState.number} />
        ) : clockState.phase === "shown" ? (
          clockLabel(clockState.ms)
        ) : clockState.phase === "fading" ? (
          clockLabel(REVEAL_MS)
        ) : (
          ""
        )}
      </span>
      <span className={styles.prompt}>Tap when you think {targetLabel(params.targetMs)} have passed</span>
      <span className={styles.hint}>Tap, click or press Space</span>
    </button>
  );
}
