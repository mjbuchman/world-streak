import styles from "./RoundProgress.module.css";

type StepState = "done" | "failed" | "current" | "later";

function stepState(step: number, current: number, failedRound: number | undefined): StepState {
  if (step === failedRound) return "failed";
  if (step < current) return "done";
  return step === current ? "current" : "later";
}

/**
 * The 1-2-3-4 bar over a round-based game (T178): finished rounds mint, the failed one light
 * tangerine, the current one ringed, later ones outlined. `current` and `failedRound` are 0-based.
 */
export function RoundProgress({ total, current, failedRound }: { total: number; current: number; failedRound?: number }) {
  return (
    <div className={styles.bar} role="img" aria-label={`Round ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, step) => (
        <span key={step} className={styles.step} data-step={stepState(step, current, failedRound)}>
          {step + 1}
        </span>
      ))}
    </div>
  );
}
