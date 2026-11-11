"use client";

import { deadlineFor, gameDateAt } from "@/lib/gameDay";
import styles from "./Countdown.module.css";
import { useNow } from "./useNow";

/** h:mm:ss until the deadline, never below zero. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * "Closes in h:mm:ss" until today's deadline, worked out from the game-day clock, so it rolls
 * over to the next day by itself at midnight UTC. Blank until mounted (see useNow).
 */
export function Countdown() {
  const now = useNow();
  const text = now === null ? "" : `Closes in ${formatCountdown(deadlineFor(gameDateAt(new Date(now))).getTime() - now)}`;
  return (
    <p className={styles.countdown} role="timer">
      {text}
    </p>
  );
}
