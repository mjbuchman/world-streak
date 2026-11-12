"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { Confetti } from "./Confetti";
import styles from "./ui.module.css";

export type ResultTone = "pass" | "practice" | "plain";

type ResultHeroProps = {
  /** The big number; repeated for the eye only, so the heading or text must say it too. */
  score?: number;
  heading: ReactNode;
  /**
   * "pass": mint with a glow (today's attempt passed). "practice": mint, no glow (practice never
   * counts). "plain": the default, plain text (a fail, a refused submission).
   */
  tone?: ResultTone;
  /** Falling blocks behind the result (a fresh pass). */
  confetti?: boolean;
  /** A muted closing line under the text ("Practice never counts.", "Come back tomorrow."). */
  note?: ReactNode;
  /** The buttons and links under the result, in one column. */
  actions: ReactNode;
  children?: ReactNode;
};

/**
 * The end of a run, on /play and in practice: the big score on top (the human's choice at the
 * second play-test), then the heading, the text and the actions, popping in together.
 */
export function ResultHero({ score, heading, tone = "plain", confetti = false, note, actions, children }: ResultHeroProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The game (which had focus) is gone: focus the outcome so screen readers announce it and a key
  // still held from the game lands on the heading, not on an action (T60, T90).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    // The stylesheet colours the score and heading by data-tone, which tests can read as well.
    <section className={styles.result} data-tone={tone}>
      {confetti && <Confetti />}
      {score !== undefined && (
        <p data-big-score aria-hidden="true" className={styles.resultScore}>
          {score}
        </p>
      )}
      <h2 ref={headingRef} tabIndex={-1} className={styles.resultHeading}>
        {heading}
      </h2>
      {children}
      {note && <p className={styles.resultNote}>{note}</p>}
      <div className={styles.resultActions}>{actions}</div>
    </section>
  );
}
