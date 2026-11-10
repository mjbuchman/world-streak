import type { ReactNode, Ref } from "react";
import { Confetti } from "./Confetti";
import styles from "./ui.module.css";

export type ResultTone = "pass" | "practice" | "plain";

const TONE_CLASSES: Record<ResultTone, string> = {
  pass: `${styles.resultMint} ${styles.resultGlow}`,
  practice: styles.resultMint,
  plain: "",
};

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
  const toneClass = TONE_CLASSES[tone];
  return (
    <section className={styles.result}>
      {confetti && <Confetti />}
      {score !== undefined && (
        <p data-big-score aria-hidden="true" className={`${styles.resultScore} ${toneClass}`}>
          {score}
        </p>
      )}
      <h2 ref={headingRef} tabIndex={-1} className={`${styles.resultHeading} ${toneClass}`}>
        {heading}
      </h2>
      {children}
      <div className={styles.resultActions}>{actions}</div>
    </section>
  );
}
