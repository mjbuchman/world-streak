"use client";

import { useEffect, useRef, useState } from "react";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { CountdownNumber, countdownNumber } from "../countdown/CountdownNumber";
import { runFrames } from "../frameLoop";
import styles from "./RoundCountdown.module.css";

/**
 * The 3-2-1 before each round (T178), timed by elapsed time from its first frame, with a
 * "Round N" caption (`round` is 0-based). Calls `onDone` once when it is over; with `ms={0}` it
 * calls it at once and renders nothing.
 */
export function RoundCountdown({ round, ms = RUN_COUNTDOWN_MS, onDone }: { round: number; ms?: number; onDone: () => void }) {
  const [value, setValue] = useState(() => countdownNumber(0, ms));
  const onDoneRef = useRef(onDone);
  // Strict Mode runs the effect twice; the countdown still ends only once.
  const ended = useRef(false);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const end = () => {
      if (ended.current) return;
      ended.current = true;
      onDoneRef.current();
    };
    if (ms <= 0) {
      end();
      return;
    }
    let start: number | null = null;
    return runFrames((now) => {
      start ??= now;
      const next = countdownNumber(now - start, ms);
      setValue(next);
      if (next !== null) return true;
      end();
      return false;
    });
  }, [ms]);

  if (ms <= 0) return null;
  return (
    <div className={styles.slot}>
      <p className={styles.caption}>Round {round + 1}</p>
      <div className={styles.stage}>{value !== null && <CountdownNumber key={value} value={value} />}</div>
    </div>
  );
}
