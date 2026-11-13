import { COUNTDOWN_STEP_MS, RUN_COUNTDOWN_MS } from "@/config/countdown";
import styles from "./CountdownNumber.module.css";

/** The number to show `elapsedMs` into a 3-2-1 lasting `totalMs`, or null once it is over. */
export function countdownNumber(elapsedMs: number, totalMs: number = RUN_COUNTDOWN_MS): number | null {
  return elapsedMs < totalMs ? Math.ceil((totalMs - elapsedMs) / COUNTDOWN_STEP_MS) : null;
}

/**
 * One number of the 3-2-1 before a run (T119, T138), centred over its positioned parent. Key it
 * on the value so each number plays its pop again. Hidden from screen readers: each game's own
 * label or prompt is what they read.
 */
export function CountdownNumber({ value }: { value: number }) {
  return (
    <span className={styles.number} data-countdown="" aria-hidden="true">
      {value}
    </span>
  );
}
