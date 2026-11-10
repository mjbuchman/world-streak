"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StackingParams } from "@/challenges/stacking/engine";
import { blocks } from "@/components/stacking/blocks";
import { type FinishedRun, StackingGame } from "@/components/stacking/StackingGame";
import { Button } from "@/components/ui/Button";
import { Confetti } from "@/components/ui/Confetti";
import { LinkButton } from "@/components/ui/LinkButton";
import { Spinner } from "@/components/ui/Spinner";
import { Surface } from "@/components/ui/Surface";
import { STACKING_HOW_TO } from "@/config/challenges";
import type { PlayStatus } from "@/lib/attempts/today";
import styles from "./play.module.css";

type Verdict = { score: number; passed: boolean; passTarget: number };

// The parts of the endpoints' JSON this page reads (see src/lib/attempts/start.ts and submit.ts).
type StartBody = { attemptId: string; params: StackingParams; passTarget: number } | { error: string; submitted?: boolean };
type SubmitBody = Verdict | { error: string };

type Phase =
  | { name: "ready"; error?: string }
  | { name: "starting" }
  | { name: "playing"; attemptId: string; params: StackingParams; passTarget: number }
  | { name: "checking" }
  // fresh: the verdict arrived in this visit (celebrated), not loaded on a later visit (not replayed).
  | { name: "result"; verdict: Verdict; fresh: boolean }
  | { name: "abandoned" }
  | { name: "failed"; message: string };

const START_FAILED = "Today's attempt could not be started. Please try again.";
// Trying again cannot fix these two, so say what will.
const START_REFUSED: Record<number, string> = {
  401: "Your session has ended. Sign in again to play.",
  403: "Finish setting up your account to play.",
};
const SUBMIT_FAILED = "Your result could not be sent. Reload the page to see whether it counted.";
const SUBMIT_REFUSED: Record<string, string> = {
  "day-closed": "Today's challenge closed before your result arrived, so it was not counted.",
  "implausible-timing": "Your result could not be checked, so it was not counted.",
};

function initialPhase(status: PlayStatus): Phase {
  if (status.kind === "submitted") return { name: "result", verdict: status, fresh: false };
  if (status.kind === "abandoned") return { name: "abandoned" };
  return { name: "ready" };
}

/**
 * Today's scored attempt: the one-attempt rule, Start, the game with the seed the server issued,
 * then the server's verdict. The client only sends its taps; the server scores them.
 */
export function PlayToday({ initial }: { initial: PlayStatus }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(initial));
  const headingRef = useRef<HTMLHeadingElement>(null);

  // As in practice (T60): when the game goes, focus the outcome so it is announced and a Space
  // still held from the last drop cannot press anything.
  useEffect(() => {
    if (phase.name === "result" || phase.name === "failed") headingRef.current?.focus();
  }, [phase.name]);

  async function start() {
    setPhase({ name: "starting" });
    try {
      const response = await fetch("/api/attempts/start", { method: "POST" });
      const body: StartBody = await response.json();
      if ("attemptId" in body) {
        const { attemptId, params, passTarget } = body;
        return setPhase({ name: "playing", attemptId, params, passTarget });
      }
      if (response.status === 409) {
        // Already submitted (perhaps in another tab): the page shows that result once refreshed.
        if (body.submitted) return router.refresh();
        return setPhase({ name: "abandoned" });
      }
      return setPhase({ name: "ready", error: START_REFUSED[response.status] ?? START_FAILED });
    } catch {
      // Offline, or not JSON: offer Start again.
      setPhase({ name: "ready", error: START_FAILED });
    }
  }

  async function submit(attemptId: string, { taps }: FinishedRun) {
    setPhase({ name: "checking" });
    try {
      const response = await fetch("/api/attempts/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, inputs: { tapsMs: taps } }),
      });
      const body: SubmitBody = await response.json();
      if (!("error" in body)) return setPhase({ name: "result", verdict: body, fresh: true });
      // Already recorded (perhaps from another tab): the refreshed page shows the stored result.
      if (body.error === "already-submitted") return router.refresh();
      return setPhase({ name: "failed", message: SUBMIT_REFUSED[body.error] ?? SUBMIT_FAILED });
    } catch {
      setPhase({ name: "failed", message: SUBMIT_FAILED });
    }
  }

  switch (phase.name) {
    case "playing":
      return (
        <StackingGame
          params={phase.params}
          passTarget={phase.passTarget}
          onFinish={(run) => submit(phase.attemptId, run)}
        />
      );

    case "checking":
      return (
        <div className={styles.checking}>
          <Spinner label="Checking your result" visibleLabel />
        </div>
      );

    case "result": {
      const { score, passed, passTarget } = phase.verdict;
      return (
        <section className={styles.result}>
          {passed && phase.fresh && <Confetti />}
          <h2 ref={headingRef} tabIndex={-1} className={`${styles.verdict} ${passed ? styles.passed : styles.notPassed}`}>
            {passed ? "Passed" : "Not this time"}
          </h2>
          {/* The big number repeats the sentence below for the eye; screen readers get the sentence. */}
          <p data-big-score aria-hidden="true" className={`${styles.score} ${passed ? styles.passed : ""}`}>
            {score}
          </p>
          <p className={styles.summary}>
            You stacked {blocks(score)}. Today&apos;s target was {blocks(passTarget)}.
          </p>
          <p className={styles.note}>
            {passed ? "You helped keep the streak alive. " : ""}Come back tomorrow for the next challenge.
          </p>
          <div className={styles.resultActions}>
            <LinkButton href="/" variant="secondary">
              Back to home
            </LinkButton>
          </div>
        </section>
      );
    }

    case "abandoned":
      return (
        <Surface>
          <p>You left today&apos;s attempt before finishing, so it counted as not passed. Come back tomorrow.</p>
          <LinkButton href="/" variant="secondary">
            Back to home
          </LinkButton>
        </Surface>
      );

    case "failed":
      return (
        <section className={styles.result}>
          <h2 ref={headingRef} tabIndex={-1} className={`${styles.verdict} ${styles.notPassed}`}>
            Not counted
          </h2>
          <p role="alert">{phase.message}</p>
          <div className={styles.resultActions}>
            <LinkButton href="/" variant="secondary">
              Back to home
            </LinkButton>
          </div>
        </section>
      );

    default:
      return (
        <Surface>
          <p>{STACKING_HOW_TO}</p>
          <p>
            You get one scored attempt today. Pressing Start uses it: if you leave before you finish, it counts as not
            passed and you cannot try again until tomorrow.
          </p>
          {phase.name === "ready" && phase.error && (
            <p role="alert" className={styles.error}>
              {phase.error}
            </p>
          )}
          <Button onClick={start} loading={phase.name === "starting"}>
            Start
          </Button>
          {/* Gone once Start is pressed: leaving after the server creates the attempt would lose it. */}
          {phase.name === "ready" && (
            <Link href="/practice/stacking" className={styles.practice}>
              Practice first
            </Link>
          )}
        </Surface>
      );
  }
}
