"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import type { ChallengeType } from "@/challenges/shared/types";
import { challengeUi } from "@/components/challenges/challengeUi";
import { Meter } from "@/components/Meter";
import { ShareCard } from "@/components/ShareCard";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Spinner } from "@/components/ui/Spinner";
import { Surface } from "@/components/ui/Surface";
import type { PlayStatus } from "@/lib/attempts/today";
import { START_FAILED, type StartBody, startOutcome, SUBMIT_FAILED, type SubmitBody, submitOutcome, type Verdict } from "./outcomes";
import styles from "./play.module.css";

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
  // The server reported a state this page cannot know (a 409); router.refresh() is fetching it.
  | { name: "refreshing" }
  | { name: "failed"; heading: string; message: string };

// The refresh brought nothing new (or only "ready", which would just offer Start again).
const STALE: Phase = {
  name: "failed",
  heading: "Reload the page",
  message: "Your attempt's latest state could not be loaded. Reload the page to see it.",
};

/** What a fresh `initial` from the server means for the phase on screen (T69). */
function afterServerUpdate(phase: Phase, status: PlayStatus): Phase {
  // A refresh must never unmount a run, a result being checked or a start in flight.
  if (phase.name === "playing" || phase.name === "checking" || phase.name === "starting") return phase;
  // Nor replace this visit's result (with its confetti) by the same result, stored.
  if (phase.name === "result" && status.kind === "submitted") return phase;
  const next = initialPhase(status);
  return phase.name === "refreshing" && next.name === "ready" ? STALE : next;
}

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
export function PlayToday({
  challenge,
  initial,
  afterResult,
}: {
  challenge: ChallengeType;
  initial: PlayStatus;
  /** Shown below the result only, never during a run (the ad slot, T44). */
  afterResult?: ReactNode;
}) {
  const ui = challengeUi(challenge);
  const router = useRouter();
  const [current, setPhase] = useState<Phase>(() => initialPhase(initial));
  const [refreshPending, startRefresh] = useTransition();

  // Each server refresh passes a new `initial`: follow it, except mid-run (T69; the page used to
  // remount on a changed status, which could end a run).
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setPhase(afterServerUpdate(current, initial));
  }

  // The refresh finished without a new `initial`: say so rather than spin forever.
  const phase = current.name === "refreshing" && !refreshPending ? STALE : current;

  function refreshFromServer() {
    setPhase({ name: "refreshing" });
    startRefresh(() => router.refresh());
  }

  async function start() {
    setPhase({ name: "starting" });
    try {
      const response = await fetch("/api/attempts/start", { method: "POST" });
      const outcome = startOutcome(response.status, (await response.json()) as StartBody);
      if (outcome.name === "refresh") return refreshFromServer();
      setPhase(outcome);
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
      const outcome = submitOutcome((await response.json()) as SubmitBody);
      if (outcome.name === "refresh") return refreshFromServer();
      setPhase(outcome.name === "result" ? { ...outcome, fresh: true, challengeType } : outcome);
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
    case "refreshing":
      return (
        <div className={styles.checking}>
          <Spinner label={phase.name === "checking" ? "Checking your result" : "Loading your attempt"} visibleLabel />
        </div>
      );

    case "result": {
      const { score, passed, passTarget } = phase.verdict;
      return (
        <>
          <ResultHero
            score={score}
            heading={passed ? "Passed" : "Not this time"}
            tone={passed ? "pass" : "plain"}
            confetti={passed && phase.fresh}
            note={`${passed ? "You helped keep the streak alive. " : ""}Come back tomorrow for the next challenge.`}
            actions={backHome}
          >
            <p className={styles.summary}>{challengeUi(phase.challengeType ?? challenge).summary(score, passTarget)}</p>
          </ResultHero>
          {/* Spoiler-free, so sharing it gives nothing away (T32). */}
          <ShareCard passed={passed} />
          {/* How the world is doing today, below your own result. */}
          <Meter />
          {afterResult}
        </>
      );
    }

    case "abandoned":
      return (
        <Surface>
          {/* Since T87 a run has no time limit, so it may still be open in another tab (T91). */}
          <p>
            You started today&apos;s attempt but haven&apos;t finished it here. If it&apos;s still open in another tab,
            finish it there before the day ends. Otherwise it counts as not passed. Come back tomorrow.
          </p>
          {backHome}
        </Surface>
      );

    case "failed":
      return (
        <ResultHero heading={phase.heading} actions={backHome}>
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
