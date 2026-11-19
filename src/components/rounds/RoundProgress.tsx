import { Fragment } from "react";
import styles from "./RoundProgress.module.css";

type StepState = "done" | "failed" | "current" | "later";

function stepState(step: number, current: number, failedRound: number | undefined): StepState {
  if (step === failedRound) return "failed";
  if (step < current) return "done";
  return step === current ? "current" : "later";
}

/**
 * The round counter over a round-based game (T178, T224): one big number per round joined by bars.
 * A passed round lights its number and the bar after it mint; a failed one is tangerine with its bar
 * unlit; the current one is ringed; later ones are outlined. `current` and `failedRound` are 0-based.
 */
export function RoundProgress({ total, current, failedRound }: { total: number; current: number; failedRound?: number }) {
  return (
    <div className={styles.counter} role="img" aria-label={`Round ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, step) => {
        const state = stepState(step, current, failedRound);
        return (
          <Fragment key={step}>
            <span className={styles.step} data-step={state}>
              {step + 1}
            </span>
            {step < total - 1 && <span className={styles.bar} data-bar={state === "done" ? "lit" : "unlit"} />}
          </Fragment>
        );
      })}
    </div>
  );
}
