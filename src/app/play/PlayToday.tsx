"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { challengeUi } from "@/components/challenges/challengeUi";
import { Meter } from "@/components/Meter";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Spinner } from "@/components/ui/Spinner";
import { Surface } from "@/components/ui/Surface";
import type { PlayStatus } from "@/lib/attempts/today";
import styles from "./play.module.css";

type Verdict = { score: number; passed: boolean; passTarget: number };

// The parts of the endpoints' JSON this page reads (see src/lib/attempts/start.ts and submit.ts).
type StartBody =
  | { attemptId: string; challengeType: string; params: unknown; passTarget: number }
  | { error: string; submitted?: boolean };
type SubmitBody = Verdict | { error: string };

type Phase =
  | { name: "ready"; error?: string }
  | { name: "starting" }
  // The challenge the server started, which decides the game shown.
  | { name: "playing"; attemptId: string; challengeType: ChallengeType; params: unknown; passTarget: number }
  | { name: "checking" }
  // fresh: the verdict arrived in this visit (celebrated), not loaded on a later visit (not replayed).
  // challengeType: the challenge played, when this visit played it (the page's may be a day old).
  | { name: "result"; verdict: Verdict; fresh: boolean; challengeType?: ChallengeType }
  | { name: "abandoned" }
  | { name: "failed"; heading: string; message: string };

const START_FAILED = "Today's attempt could not be started. Please try again.";
// Start raced the deadline and the day closed first; nothing was stored, so nothing counted.
const START_DAY_CLOSED = "Today's challenge just closed. Press Start to play the next one.";
// Trying again cannot fix these two, so say what will.
const START_REFUSED: Record<number, string> = {
  401: "Your session has ended. Sign in again to play.",
  403: "Finish setting up your account to play.",
};
// A refused result still counts as an attempt that did not pass (started attempts count, T17).
// One that never arrived may or may not have been recorded, so it says only that.
const SUBMIT_FAILED = { heading: "Result not sent", message: "Your result could not be sent. Reload the page to see whether it counted." };
const REFUSED_HEADING = "Counted as not passed";
const SUBMIT_REFUSED: Record<string, string> = {
  "day-closed": "Today's challenge closed before your result arrived, so it counted as not passed.",
  "implausible-timing": "Your result could not be checked, so it counted as not passed.",
};

function initialPhase(status: PlayStatus): Phase {
  if (status.kind === "submitted") return { name: "result", verdict: status, fresh: false };
  if (status.kind === "abandoned") return { name: "abandoned" };
  return { name: "ready" };
}

/**
 * Today's scored attempt: the one-attempt rule, Start, the game with the seed the server issued,
 * then the server's verdict. The client only sends its inputs; the server scores them.
 * `challenge` is today's challenge as the page read it (for the how-to and the result).
 */
export function PlayToday({ challenge, initial }: { challenge: ChallengeType; initial: PlayStatus }) {
  const ui = challengeUi(challenge);
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
        const { attemptId, challengeType, params, passTarget } = body;
        // A challenge this page cannot draw would leave the attempt unplayable: report it.
        if (!isChallengeType(challengeType)) return setPhase({ name: "ready", error: START_FAILED });
        return setPhase({ name: "playing", attemptId, challengeType, params, passTarget });
      }
      if (response.status === 409 && body.error === "day-closed") return setPhase({ name: "ready", error: START_DAY_CLOSED });
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

  async function submit(attemptId: string, challengeType: ChallengeType, inputs: unknown) {
    setPhase({ name: "checking" });
    try {
      const response = await fetch("/api/attempts/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, inputs }),
      });
      const body: SubmitBody = await response.json();
      if (!("error" in body)) return setPhase({ name: "result", verdict: body, fresh: true, challengeType });
      // Already recorded (perhaps from another tab): the refreshed page shows the stored result.
      if (body.error === "already-submitted") return router.refresh();
      const refused = SUBMIT_REFUSED[body.error];
      return setPhase({ name: "failed", ...(refused ? { heading: REFUSED_HEADING, message: refused } : SUBMIT_FAILED) });
    } catch {
      setPhase({ name: "failed", ...SUBMIT_FAILED });
    }
  }

  const backHome = (
    <LinkButton href="/" variant="secondary">
      Back to home
    </LinkButton>
  );

  switch (phase.name) {
    case "playing":
      return challengeUi(phase.challengeType).play({
        params: phase.params,
        passTarget: phase.passTarget,
        onFinish: (inputs) => submit(phase.attemptId, phase.challengeType, inputs),
      });

    case "checking":
      return (
        <div className={styles.checking}>
          <Spinner label="Checking your result" visibleLabel />
        </div>
      );

    case "result": {
      const { score, passed, passTarget } = phase.verdict;
      return (
        <>
          <ResultHero
            score={score}
            heading={passed ? "Passed" : "Not this time"}
            headingRef={headingRef}
            tone={passed ? "pass" : "plain"}
            confetti={passed && phase.fresh}
            actions={backHome}
          >
            <p className={styles.summary}>{challengeUi(phase.challengeType ?? challenge).summary(score, passTarget)}</p>
            <p className={styles.note}>
              {passed ? "You helped keep the streak alive. " : ""}Come back tomorrow for the next challenge.
            </p>
          </ResultHero>
          {/* How the world is doing today, below your own result. */}
          <Meter />
        </>
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
        <ResultHero heading={phase.heading} headingRef={headingRef} actions={backHome}>
          <p role="alert">{phase.message}</p>
        </ResultHero>
      );

    default:
      return (
        <Surface>
          <p>{ui.howTo}</p>
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
            <Link href={ui.practicePath} className={styles.practice}>
              Practice first
            </Link>
          )}
        </Surface>
      );
  }
}
