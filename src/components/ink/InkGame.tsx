"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FEEDBACK_MS,
  play,
  ROUND_COUNTDOWN_MS,
  WORDS_PER_ROUND,
  type Colour,
  type InkAnswer,
  type InkInputs,
  type InkOutcome,
  type InkParams,
} from "@/challenges/ink/engine";
import { BUTTON_ORDER, keyColour } from "@/challenges/ink/input";
import { INK_SWATCHES } from "@/challenges/ink/palette";
import { drawInk, type InkFeedback } from "@/challenges/ink/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { INK_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import styles from "./InkGame.module.css";

type Phase = "countdown" | "gap" | "word" | "feedback" | "done";

export const HINT = "Tap the colour of the ink, not the word. Keys 1 to 4 also work.";

/** Milliseconds as seconds to one decimal ("4.2 s"): the bank's reading. */
export const seconds = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/** Each round's word costs summed, so the gauge's segments and captions are per round. */
export const roundCosts = (costs: readonly number[]) =>
  costs.reduce<number[]>((sums, cost, w) => {
    const k = Math.floor(w / WORDS_PER_ROUND);
    sums[k] = (sums[k] ?? 0) + cost;
    return sums;
  }, []);

/** The feedback a settled word shows on the canvas. */
function feedbackOf(params: InkParams, outcome: InkOutcome): InkFeedback {
  const word = params.rounds[Math.floor(outcome.word / WORDS_PER_ROUND)].words[outcome.word % WORDS_PER_ROUND];
  const result = outcome.kind === "timeout" ? "timeout" : outcome.correct ? "right" : "wrong";
  return { result, answer: word.ink };
}

/** What the live status says after an answer: in words, never by colour. */
function statusText(feedback: InkFeedback | null): string {
  if (!feedback) return "";
  if (feedback.result === "right") return "Correct";
  const answer = `It was ${INK_SWATCHES[feedback.answer].label.toUpperCase()}.`;
  return feedback.result === "wrong" ? `Wrong. ${answer}` : `Too slow. ${answer}`;
}

/**
 * An Ink run (T251): a "Round N" 3-2-1 before every round, then its eight words one after another.
 * One of the four buttons or the keys 1 to 4 answers, through the same path; after each answer a
 * short feedback beat. One frame loop on one clock from the game's start draws all of it, so the
 * screen and the engine agree on every timing.
 */
export function InkGame({ params, onFinish }: { params: InkParams; onFinish: (inputs: InkInputs) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const answers = useRef<InkAnswer[]>([]);
  const done = useRef(false);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  });

  const [phase, setPhase] = useState<Phase>("countdown");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [word, setWord] = useState(0);
  const [costs, setCosts] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("");

  const stateAt = useCallback((t: number) => play(params, { answers: answers.current, endMs: t }), [params]);

  /** Brings the word, the bank and the status up to date with the engine at `t`. */
  const settle = useCallback(
    (t: number) => {
      const state = stateAt(t);
      setWord(state.word);
      setCosts((previous) => (previous.length === state.costs.length ? previous : state.costs));
      setFailed(state.failed);
      setStatus(statusText(state.last && feedbackOf(params, state.last)));
      return state;
    },
    [params, stateAt],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const colors = readColorTokens(canvas, INK_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const t = now - startedAt.current;
      const state = settle(t);
      const base = { ...fitCanvas(canvas), reducedMotion: reducedRef.current, colors, msSinceWord: 0, limitMs: 1 };
      const { last } = state;
      if (last !== null && t < last.atMs + FEEDBACK_MS) {
        setPhase("feedback");
        setCountdown(null);
        drawInk(ctx, { ...base, word: null, feedback: feedbackOf(params, last) });
        return true;
      }
      if (state.finished || state.appearsAt === null || state.deadline === null) {
        if (!done.current && last !== null) {
          done.current = true;
          setPhase("done");
          // The run ends when the last feedback beat does; the engine's lastInputMs is this endMs.
          finishRef.current({ answers: answers.current, endMs: last.atMs + FEEDBACK_MS });
        }
        return false;
      }
      const roundStart = state.appearsAt - ROUND_COUNTDOWN_MS;
      if (t < state.appearsAt) {
        const counting = state.word % WORDS_PER_ROUND === 0 && t >= roundStart;
        setPhase(counting ? "countdown" : "gap");
        setCountdown(counting ? countdownNumber(t - roundStart, ROUND_COUNTDOWN_MS) : null);
        drawInk(ctx, { ...base, word: null, feedback: null });
        return true;
      }
      setPhase("word");
      setCountdown(null);
      const shown = params.rounds[state.round].words[state.word % WORDS_PER_ROUND];
      drawInk(ctx, { ...base, word: shown, msSinceWord: t - state.appearsAt, limitMs: state.deadline - state.appearsAt, feedback: null });
      return true;
    };
    return runFrames(tick);
  }, [params, settle]);

  /** The one answer path: ignored unless a word is on screen and still open. */
  const answer = (colour: Colour) => {
    if (startedAt.current === null || done.current) return;
    const t = performance.now() - startedAt.current;
    const state = stateAt(t);
    if (state.appearsAt === null || t < state.appearsAt || (answers.current.at(-1)?.atMs ?? -1) >= t) return;
    answers.current = [...answers.current, { word: state.word, atMs: t, colour }];
    settle(t);
    setPhase("feedback");
  };
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });

  // Keys work wherever focus is, so a player need not click the board after Start.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const colour = keyColour(event.key);
      if (!colour || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      // A held key must not answer the next word the moment it appears.
      if (event.repeat) return;
      answerRef.current(colour);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const round = Math.floor(word / WORDS_PER_ROUND);
  const label =
    phase === "countdown"
      ? `Round ${round + 1}. Get ready.`
      : phase === "word"
        ? `Word ${(word % WORDS_PER_ROUND) + 1} of ${WORDS_PER_ROUND}, round ${round + 1}`
        : phase === "done"
          ? "Done."
          : // The live status below announces the feedback, so the label does not repeat it.
            "Next word coming.";
  return (
    <div className={styles.game}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={params.rounds.length} current={round} failedRound={failed ? round : undefined} />
      <BankGauge total={params.bank} spent={roundCosts(costs)} format={seconds} label="Time bank" />
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.board} data-phase={phase} role="img" aria-label={label} />
        {countdown !== null && (
          <>
            <p className={styles.caption}>Round {round + 1}</p>
            <CountdownNumber key={countdown} value={countdown} />
          </>
        )}
      </div>
      <div className={styles.pad}>
        {BUTTON_ORDER.map((colour) => {
          const swatch = INK_SWATCHES[colour];
          return (
            <button
              key={colour}
              type="button"
              style={{ background: `var(${swatch.token})`, color: `var(${swatch.labelToken})` }}
              onClick={() => answer(colour)}
            >
              {swatch.label}
            </button>
          );
        })}
      </div>
      <p className={styles.hint} aria-live="polite">
        {phase === "feedback" ? status : HINT}
      </p>
    </div>
  );
}
