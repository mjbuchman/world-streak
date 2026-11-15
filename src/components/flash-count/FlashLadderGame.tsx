"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIVES,
  layoutFor,
  play,
  REVEAL_MS,
  tolerance,
  type FlashLadderInputs,
  type FlashLadderParams,
} from "@/challenges/flash-count/flashLadder";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { FlashCountGame } from "./FlashCountGame";
import styles from "./FlashLadderGame.module.css";

type Answer = FlashLadderInputs["answers"][number];

/** "Right" or "Off by 3": the last answer against the level it was for. */
function revealLabel(params: FlashLadderParams, answers: Answer[]): string {
  const { dotCount } = params.levels[play(params, { answers: answers.slice(0, -1) }).cleared];
  const off = Math.abs(answers[answers.length - 1].count - dotCount);
  return off <= tolerance(dotCount) ? "Right" : `Off by ${off}`;
}

type FlashLadderGameProps = {
  params: FlashLadderParams;
  onFinish: (inputs: FlashLadderInputs) => void;
  /** How long the 3-2-1 before level 1 lasts; 0 skips it (tests of the run alone). */
  countdownMs?: number;
};

/**
 * A Swift Sum: Flash Ladder run: the Swift Sum flash, level after level. After each answer
 * "Right" or "Off by N" shows for REVEAL_MS, then the next level (or the same level again, with a
 * new layout, after a miss) flashes at once, without a 3-2-1. Answers are timed from the start.
 */
export function FlashLadderGame({ params, onFinish, countdownMs = RUN_COUNTDOWN_MS }: FlashLadderGameProps) {
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = performance.now();
  }, []);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [revealing, setRevealing] = useState(false);
  const { cleared, lives, tryIndex, finished } = play(params, { answers });

  // Memoised: the flash restarts whenever its params change, so they must only change per showing.
  const showing = useMemo(
    () => (cleared < params.levels.length ? { ...params.levels[cleared], dots: layoutFor(params, cleared, tryIndex) } : null),
    [params, cleared, tryIndex],
  );

  useEffect(() => {
    if (!revealing || finished) return;
    const timer = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealing, finished]);

  // Reads this render's answers: safe because each showing is a fresh FlashCountGame that answers once.
  const answer = ({ count }: { count: number }) => {
    const next = [...answers, { count, atMs: performance.now() - (startedAt.current ?? 0) }];
    setAnswers(next);
    setRevealing(true);
    if (play(params, { answers: next }).finished) onFinish({ answers: next });
  };

  return (
    <div className={styles.ladder}>
      <div className={styles.status}>
        <p className={styles.level}>
          Level {Math.min(cleared + 1, params.levels.length)} of {params.levels.length}
        </p>
        <span role="img" aria-label={`${lives} of ${LIVES} lives left`} className={styles.lives}>
          {Array.from({ length: LIVES }, (_, i) => (
            <span key={i} className={styles.pip} data-lost={i >= lives || undefined} />
          ))}
        </span>
      </div>
      {revealing || finished || !showing ? (
        <p className={styles.reveal} role="status">
          {revealLabel(params, answers)}
        </p>
      ) : (
        <FlashCountGame key={answers.length} params={showing} countdownMs={answers.length === 0 ? countdownMs : 0} onFinish={answer} />
      )}
    </div>
  );
}
