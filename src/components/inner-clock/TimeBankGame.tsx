"use client";

import { useEffect, useState } from "react";
import { play, ROUND_GAP_MS, roundErrorMs, timeBank, type TimeBankInputs, type TimeBankParams } from "@/challenges/inner-clock/timeBank";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { InnerClockGame } from "./InnerClockGame";
import styles from "./TimeBankGame.module.css";

/** "2.8 s": ms as seconds, to the ms. */
const seconds = (ms: number) => `${Math.round(ms) / 1000} s`;

/** A round's error as players read it, as the engine counts it (a late tap past the timeout ran out). */
function errorLabel(round: TimeBankParams["rounds"][number], tapMs: number | null): string {
  if (tapMs === null || tapMs > round.timeoutMs) return "Time ran out";
  const errorMs = roundErrorMs(round, tapMs);
  if (errorMs === 0) return "Spot on";
  return `${seconds(errorMs)} ${tapMs > round.targetMs ? "late" : "early"}`;
}

type TimeBankGameProps = {
  params: TimeBankParams;
  onFinish: (inputs: TimeBankInputs) => void;
  /** How long the 3-2-1 before round 1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Second Sense: Time Bank run: the Second Sense round, again and again, with an error budget
 * that drains by each round's error. Between rounds the error shows for ROUND_GAP_MS (the engine
 * counts that gap in the run's timing), then the next round starts at once, without a 3-2-1.
 */
export function TimeBankGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: TimeBankGameProps) {
  const [tapsMs, setTapsMs] = useState<(number | null)[]>([]);
  const [showingError, setShowingError] = useState(false);
  const finished = timeBank.finished(params, { tapsMs });
  const { leftMs } = play(params, { tapsMs });
  const index = tapsMs.length;

  useEffect(() => {
    if (!showingError || finished) return;
    const timer = setTimeout(() => setShowingError(false), ROUND_GAP_MS);
    return () => clearTimeout(timer);
  }, [showingError, finished]);

  // Reads this render's taps: safe because each round is a fresh InnerClockGame (key={index}) that finishes once.
  const finishRound = ({ tapMs }: { tapMs: number | null }) => {
    const next = [...tapsMs, tapMs];
    setTapsMs(next);
    setShowingError(true);
    if (timeBank.finished(params, { tapsMs: next })) onFinish({ tapsMs: next });
  };

  const last = index - 1;
  return (
    <div className={styles.bank}>
      <div className={styles.status}>
        <p className={styles.round}>
          Round {Math.min(index + 1, params.rounds.length)} of {params.rounds.length}
        </p>
        <div
          role="meter"
          aria-label="Error budget left"
          aria-valuemin={0}
          aria-valuemax={params.budgetMs}
          aria-valuenow={leftMs}
          aria-valuetext={`${seconds(leftMs)} of ${seconds(params.budgetMs)} left`}
          className={styles.budget}
        >
          <span className={styles.fill} style={{ width: `${(100 * leftMs) / params.budgetMs}%` }} />
        </div>
      </div>
      {showingError || finished ? (
        <p className={styles.error} role="status">
          {errorLabel(params.rounds[last], tapsMs[last])}
        </p>
      ) : (
        <InnerClockGame
          key={index}
          params={params.rounds[index]}
          countdownMs={index === 0 ? countdownMs : 0}
          onFinish={finishRound}
        />
      )}
    </div>
  );
}
