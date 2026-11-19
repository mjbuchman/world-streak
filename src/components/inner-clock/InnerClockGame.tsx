"use client";

import {
  play,
  ROUND_COUNTDOWN_MS,
  ROUND_GAP_MS,
  roundErrorMs,
  innerClock,
  type InnerClockInputs,
  type InnerClockParams,
} from "@/challenges/inner-clock/engine";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundCountdown } from "@/components/rounds/RoundCountdown";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { progressAt, useRevealRounds } from "@/components/rounds/useRevealRounds";
import { InnerClockTap, targetPrompt } from "./InnerClockTap";
import styles from "./InnerClockGame.module.css";

/** "2.8 s": ms as seconds, to the ms. */
const seconds = (ms: number) => `${Math.round(ms) / 1000} s`;

/** "2.4 s": the bank's reading, to a tenth. */
const bankSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** A round's error as players read it, as the engine counts it (a late tap past the timeout ran out). */
function errorLabel(round: InnerClockParams["rounds"][number], tapMs: number | null, budgetMs: number): string {
  if (tapMs === null || tapMs > round.timeoutMs) return "Time ran out";
  const errorMs = roundErrorMs(round, tapMs, budgetMs);
  if (errorMs === 0) return "Spot on";
  return `${seconds(errorMs)} ${tapMs > round.targetMs ? "late" : "early"}`;
}

type InnerClockGameProps = {
  params: InnerClockParams;
  onFinish: (inputs: InnerClockInputs) => void;
  /** How long the 3-2-1 before every round lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Second Sense: Time Bank run (T182): four rounds, each a 3-2-1 under its target, then the tap
 * round, then its error for ROUND_GAP_MS while the bank drains by it. The engine counts the gap
 * and every later round's 3-2-1 in the run's timing.
 */
export function InnerClockGame({ params, onFinish, countdownMs = ROUND_COUNTDOWN_MS }: InnerClockGameProps) {
  const { entries: tapsMs, inputs, phase, record, startRound } = useRevealRounds<number | null, InnerClockInputs>({
    toInputs: (entries) => ({ tapsMs: entries }),
    isFinished: (run) => innerClock.finished(params, run),
    revealMs: ROUND_GAP_MS,
    onFinish,
  });
  const index = tapsMs.length;
  const costs = tapsMs.map((tapMs, i) => roundErrorMs(params.rounds[i], tapMs, params.budgetMs));

  const last = index - 1;
  return (
    <div className={styles.bank}>
      <RoundProgress {...progressAt(index, params.rounds.length, play(params, inputs))} />
      <BankGauge total={params.budgetMs} spent={costs} format={bankSeconds} label="Time bank" />
      {phase === "countdown" ? (
        <div className={styles.waiting}>
          <p className={styles.target}>{targetPrompt(params.rounds[index].targetMs)}</p>
          <RoundCountdown key={index} round={index} ms={countdownMs} onDone={startRound} />
        </div>
      ) : phase === "round" ? (
        <InnerClockTap key={index} params={params.rounds[index]} countdownMs={0} onFinish={({ tapMs }) => record(tapMs)} />
      ) : (
        <p className={styles.error} role="status">
          {errorLabel(params.rounds[last], tapsMs[last], params.budgetMs)}
        </p>
      )}
    </div>
  );
}
