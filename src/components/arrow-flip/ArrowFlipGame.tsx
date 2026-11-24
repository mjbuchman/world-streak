"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  answerOf,
  FEEDBACK_MS,
  play,
  PROMPTS_PER_ROUND,
  ROUND_COUNTDOWN_MS,
  type ArrowFlipAnswer,
  type ArrowFlipInputs,
  type ArrowFlipOutcome,
  type ArrowFlipParams,
  type Direction,
} from "@/challenges/arrow-flip/engine";
import { BUTTONS, keyDirection, swipeDirection } from "@/challenges/arrow-flip/input";
import { drawArrowFlip, type ArrowFlipFeedback } from "@/challenges/arrow-flip/render";
import { fitCanvas, readColorTokens } from "@/components/canvas";
import { ARROW_FLIP_COLOR_TOKENS } from "@/components/canvasTokens";
import { CountdownNumber, countdownNumber } from "@/components/countdown/CountdownNumber";
import { runFrames } from "@/components/frameLoop";
import { BankGauge } from "@/components/rounds/BankGauge";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { usePrefersReducedMotion } from "@/components/ui/useReducedMotion";
import styles from "./ArrowFlipGame.module.css";

type Phase = "countdown" | "gap" | "prompt" | "feedback" | "done";

/** Milliseconds as seconds to one decimal ("4.2 s"): the bank's reading. */
export const seconds = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;

/** Each round's prompt costs summed, so the gauge's segments and captions are per round. */
export const roundCosts = (costs: readonly number[]) =>
  costs.reduce<number[]>((sums, cost, p) => {
    const k = Math.floor(p / PROMPTS_PER_ROUND);
    sums[k] = (sums[k] ?? 0) + cost;
    return sums;
  }, []);

/** The feedback a settled prompt shows on the canvas. */
function feedbackOf(params: ArrowFlipParams, outcome: ArrowFlipOutcome): ArrowFlipFeedback {
  const prompt = params.rounds[Math.floor(outcome.prompt / PROMPTS_PER_ROUND)].prompts[outcome.prompt % PROMPTS_PER_ROUND];
  const result = outcome.kind === "timeout" ? "timeout" : outcome.correct ? "right" : "wrong";
  return { result, answer: answerOf(prompt) };
}

/** What the live status says after an answer: in words, never by colour. */
function statusText(feedback: ArrowFlipFeedback | null): string {
  if (!feedback) return "";
  if (feedback.result === "right") return "Right";
  const answer = `It was ${feedback.answer.toUpperCase()}.`;
  return feedback.result === "wrong" ? `Wrong. ${answer}` : `Too slow. ${answer}`;
}

/**
 * An Arrow Flip run (T238): a "Round N" 3-2-1 before every round, then its six prompts one after
 * another. A swipe on the canvas, one of the four buttons or an arrow key answers, all through the
 * same path; after each answer a short feedback beat. One frame loop on one clock from the game's
 * start draws all of it, so the screen and the engine agree on every timing.
 */
export function ArrowFlipGame({ params, onFinish }: { params: ArrowFlipParams; onFinish: (inputs: ArrowFlipInputs) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef<number | null>(null);
  const answers = useRef<ArrowFlipAnswer[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
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
  const [prompt, setPrompt] = useState(0);
  const [costs, setCosts] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("");

  const stateAt = useCallback((t: number) => play(params, { answers: answers.current, endMs: t }), [params]);

  /** Brings the prompt, the bank and the status up to date with the engine at `t`. */
  const settle = useCallback(
    (t: number) => {
      const state = stateAt(t);
      setPrompt(state.prompt);
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
    const colors = readColorTokens(canvas, ARROW_FLIP_COLOR_TOKENS);
    const tick = (now: number) => {
      startedAt.current ??= now;
      const t = now - startedAt.current;
      const state = settle(t);
      const base = { ...fitCanvas(canvas), reducedMotion: reducedRef.current, colors, msSincePrompt: 0, limitMs: 1 };
      const { last } = state;
      if (last !== null && t < last.atMs + FEEDBACK_MS) {
        setPhase("feedback");
        setCountdown(null);
        drawArrowFlip(ctx, { ...base, prompt: null, feedback: feedbackOf(params, last) });
        return true;
      }
      if (state.finished || state.appearsAt === null || state.deadline === null) {
        if (!done.current && last !== null) {
          done.current = true;
          setPhase("done");
          finishRef.current({ answers: answers.current, endMs: last.atMs + FEEDBACK_MS });
        }
        return false;
      }
      const roundStart = state.appearsAt - ROUND_COUNTDOWN_MS;
      if (t < state.appearsAt) {
        const counting = state.prompt % PROMPTS_PER_ROUND === 0 && t >= roundStart;
        setPhase(counting ? "countdown" : "gap");
        setCountdown(counting ? countdownNumber(t - roundStart, ROUND_COUNTDOWN_MS) : null);
        drawArrowFlip(ctx, { ...base, prompt: null, feedback: null });
        return true;
      }
      setPhase("prompt");
      setCountdown(null);
      const shown = params.rounds[state.round].prompts[state.prompt % PROMPTS_PER_ROUND];
      drawArrowFlip(ctx, { ...base, prompt: shown, msSincePrompt: t - state.appearsAt, limitMs: state.deadline - state.appearsAt, feedback: null });
      return true;
    };
    return runFrames(tick);
  }, [params, settle]);

  /** The one answer path: ignored unless a prompt is on screen and still open. */
  const answer = (dir: Direction) => {
    if (startedAt.current === null || done.current) return;
    const t = performance.now() - startedAt.current;
    const state = stateAt(t);
    if (state.appearsAt === null || t < state.appearsAt || (answers.current.at(-1)?.atMs ?? -1) >= t) return;
    answers.current = [...answers.current, { prompt: state.prompt, atMs: t, dir }];
    settle(t);
    setPhase("feedback");
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = swipe.current;
    swipe.current = null;
    const dir = from && swipeDirection(event.clientX - from.x, event.clientY - from.y);
    if (dir) answer(dir);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const dir = keyDirection(event.key);
    if (!dir) return;
    event.preventDefault();
    answer(dir);
  };

  const round = Math.floor(prompt / PROMPTS_PER_ROUND);
  const label =
    phase === "countdown"
      ? `Round ${round + 1}. Get ready.`
      : phase === "prompt"
        ? `Prompt ${(prompt % PROMPTS_PER_ROUND) + 1} of ${PROMPTS_PER_ROUND}, round ${round + 1}`
        : phase === "done"
          ? "Done."
          : status;
  return (
    <div className={styles.game} onKeyDown={onKeyDown}>
      {/* A failed run stays on the round that failed; later rounds were never played. */}
      <RoundProgress total={params.rounds.length} current={round} failedRound={failed ? round : undefined} />
      <BankGauge total={params.bank} spent={roundCosts(costs)} format={seconds} label="Time bank" />
      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          className={styles.board}
          data-phase={phase}
          role="img"
          tabIndex={0}
          aria-label={label}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        />
        {countdown !== null && (
          <>
            <p className={styles.caption}>Round {round + 1}</p>
            <CountdownNumber key={countdown} value={countdown} />
          </>
        )}
      </div>
      <div className={styles.pad}>
        {BUTTONS.map(({ dir, name }) => (
          <button key={dir} type="button" aria-label={name} onClick={() => answer(dir)}>
            <span aria-hidden="true" className={styles.glyph} data-dir={dir}>
              ➜
            </span>
          </button>
        ))}
      </div>
      <p className={styles.hint} aria-live="polite">
        {phase === "feedback" ? status : "Swipe, tap a button or press an arrow key: follow WORD or ARROW."}
      </p>
    </div>
  );
}
