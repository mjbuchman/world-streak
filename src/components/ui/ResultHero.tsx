import type { ReactNode, Ref } from "react";
import { Confetti } from "./Confetti";
import styles from "./ui.module.css";

export type ResultTone = "pass" | "practice" | "plain";

type ResultHeroProps = {
  /** The big number; repeated for the eye only, so the heading or text must say it too. */
  score?: number;
  heading: ReactNode;
  /** The page moves focus here when a run ends, so it is announced and a held key lands safely. */
  headingRef?: Ref<HTMLHeadingElement>;
  /**
   * "pass": mint with a glow (today's attempt passed). "practice": mint, no glow (practice never
   * counts). "plain": the default, plain text (a fail, a refused submission).
   */
  tone?: ResultTone;
  /** Falling blocks behind the result (a fresh pass). */
  confetti?: boolean;
  /** The buttons and links under the result, in one column. */
  actions: ReactNode;
  children?: ReactNode;
};

/**
 * The end of a run, on /play and in practice: the big score on top (the human's choice at the
 * second play-test), then the heading, the text and the actions, popping in together.
 */
export function ResultHero({ score, heading, headingRef, tone = "plain", confetti = false, actions, children }: ResultHeroProps) {
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
      <div className={styles.resultActions}>{actions}</div>
    </section>
  );
}
