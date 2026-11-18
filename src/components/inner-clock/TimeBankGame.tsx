"use client";

import { useEffect, useRef, useState } from "react";
import {
  play,
  ROUND_COUNTDOWN_MS,
  ROUND_GAP_MS,
  roundErrorMs,
  timeBank,
  type TimeBankInputs,
  type TimeBankParams,
} from "@/challenges/inner-clock/timeBank";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundCountdown } from "@/components/rounds/RoundCountdown";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { InnerClockGame, targetPrompt } from "./InnerClockGame";
import styles from "./TimeBankGame.module.css";

/** "2.8 s": ms as seconds, to the ms. */
const seconds = (ms: number) => `${Math.round(ms) / 1000} s`;

/** "2.4 s": the bank's reading, to a tenth. */
const bankSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** A round's error as players read it, as the engine counts it (a late tap past the timeout ran out). */
function errorLabel(round: TimeBankParams["rounds"][number], tapMs: number | null, budgetMs: number): string {
  if (tapMs === null || tapMs > round.timeoutMs) return "Time ran out";
  const errorMs = roundErrorMs(round, tapMs, budgetMs);
  if (errorMs === 0) return "Spot on";
  return `${seconds(errorMs)} ${tapMs > round.targetMs ? "late" : "early"}`;
}

type Phase = "countdown" | "round" | "reveal";

type TimeBankGameProps = {
  params: TimeBankParams;
  onFinish: (inputs: TimeBankInputs) => void;
  /** How long the 3-2-1 before every round lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Second Sense: Time Bank run (T182): four rounds, each a 3-2-1 under its target, then the tap
 * round, then its error for ROUND_GAP_MS while the bank drains by it. The engine counts the gap
 * and every later round's 3-2-1 in the run's timing.
 */
export function TimeBankGame({ params, onFinish, countdownMs = ROUND_COUNTDOWN_MS }: TimeBankGameProps) {
  const [tapsMs, setTapsMs] = useState<(number | null)[]>([]);
  const [phase, setPhase] = useState<Phase>("countdown");
  const finished = timeBank.finished(params, { tapsMs });
  const { survived, failed } = play(params, { tapsMs });
  const index = tapsMs.length;
  const costs = tapsMs.map((tapMs, i) => roundErrorMs(params.rounds[i], tapMs, params.budgetMs));

  // The latest callback and taps, so the reveal's timer is not restarted by a re-render.
  const finishRef = useRef(onFinish);
  const tapsRef = useRef(tapsMs);
  useEffect(() => {
    finishRef.current = onFinish;
    tapsRef.current = tapsMs;
  });

  // Every error, the last one too, shows for ROUND_GAP_MS. Ending the run only after it means a
  // phone's click, which follows the tap, lands on the error rather than the result ("Play again").
  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(
      () => (finished ? finishRef.current({ tapsMs: tapsRef.current }) : setPhase("countdown")),
      ROUND_GAP_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, finished]);

  const finishRound = ({ tapMs }: { tapMs: number | null }) => {
    setTapsMs((taps) => [...taps, tapMs]);
    setPhase("reveal");
  };

  const total = params.rounds.length;
  const last = index - 1;
  return (
    <div className={styles.bank}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={total} current={failed ? survived : Math.min(index, total - 1)} failedRound={failed ? survived : undefined} />
      <BankGauge total={params.budgetMs} spent={costs} format={bankSeconds} label="Time bank" />
      {phase === "countdown" ? (
        <div className={styles.waiting}>
          <p className={styles.target}>{targetPrompt(params.rounds[index].targetMs)}</p>
          <RoundCountdown key={index} round={index} ms={countdownMs} onDone={() => setPhase("round")} />
        </div>
      ) : phase === "round" ? (
        <InnerClockGame key={index} params={params.rounds[index]} countdownMs={0} onFinish={finishRound} />
      ) : (
        <p className={styles.error} role="status">
          {errorLabel(params.rounds[last], tapsMs[last], params.budgetMs)}
        </p>
      )}
    </div>
  );
}
