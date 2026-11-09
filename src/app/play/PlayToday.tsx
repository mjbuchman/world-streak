"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { StackingParams } from "@/challenges/stacking/engine";
import { blocks } from "@/components/stacking/blocks";
import { type FinishedRun, StackingGame } from "@/components/stacking/StackingGame";
import type { PlayStatus } from "@/lib/attempts/today";
import styles from "./play.module.css";

type Verdict = { score: number; passed: boolean; passTarget: number };

// The parts of the endpoints' JSON this page reads (see src/lib/attempts/start.ts and submit.ts).
type StartBody = { attemptId: string; params: StackingParams } | { error: string; submitted?: boolean };
type SubmitBody = Verdict | { error: string };

type Phase =
  | { name: "ready"; error?: string }
  | { name: "starting" }
  | { name: "playing"; attemptId: string; params: StackingParams }
  | { name: "checking" }
  | { name: "result"; verdict: Verdict }
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
  if (status.kind === "submitted") return { name: "result", verdict: status };
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
      if ("attemptId" in body) return setPhase({ name: "playing", attemptId: body.attemptId, params: body.params });
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
      if (!("error" in body)) return setPhase({ name: "result", verdict: body });
      // Already recorded (perhaps from another tab): the refreshed page shows the stored result.
      if (body.error === "already-submitted") return router.refresh();
      return setPhase({ name: "failed", message: SUBMIT_REFUSED[body.error] ?? SUBMIT_FAILED });
    } catch {
      setPhase({ name: "failed", message: SUBMIT_FAILED });
    }
  }

  switch (phase.name) {
    case "playing":
      return <StackingGame params={phase.params} onFinish={(run) => submit(phase.attemptId, run)} />;

    case "checking":
      return (
        <p role="status" className={styles.note}>
          Checking your result
        </p>
      );

    case "result": {
      const { score, passed, passTarget } = phase.verdict;
      return (
        <section className={styles.panel}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.outcome}>
            {passed ? "Passed" : "Not this time"}
          </h2>
          <p>
            You stacked {blocks(score)}. Today&apos;s target was {blocks(passTarget)}.
          </p>
          <p className={styles.note}>Come back tomorrow for the next challenge.</p>
        </section>
      );
    }

    case "abandoned":
      return (
        <p className={styles.note}>You left today&apos;s attempt before finishing. It was not counted. Come back tomorrow.</p>
      );

    case "failed":
      return (
        <section className={styles.panel}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.outcome}>
            Not counted
          </h2>
          <p role="alert">{phase.message}</p>
        </section>
      );

    default:
      return (
        <section className={styles.panel}>
          <p>
            You get one scored attempt today. Pressing Start uses it: if you leave before you finish, it is not counted
            and you cannot try again until tomorrow.
          </p>
          {phase.name === "ready" && phase.error && (
            <p role="alert" className={styles.error}>
              {phase.error}
            </p>
          )}
          <button type="button" className={styles.button} onClick={start} disabled={phase.name === "starting"}>
            {phase.name === "starting" ? "Starting" : "Start"}
          </button>
        </section>
      );
  }
}
