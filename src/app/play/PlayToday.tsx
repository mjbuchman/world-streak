"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import { challengeUi } from "@/components/challenges/challengeUi";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Spinner } from "@/components/ui/Spinner";
import { Surface } from "@/components/ui/Surface";
import { GAMES_PER_DAY } from "@/config/attempts";
import { CHALLENGE_NAMES } from "@/config/challenges";
import type { DayProgress } from "@/lib/attempts/submit";
import type { TodaysDay } from "@/lib/attempts/today";
import { DayGames } from "./DayGames";
import {
  daySoFar,
  dayVerdict,
  RESULTS_PATH,
  START_FAILED,
  type StartBody,
  startOutcome,
  SUBMIT_FAILED,
  type SubmitBody,
  submitOutcome,
  unfinishedNote,
  type Verdict,
} from "./outcomes";
import styles from "./play.module.css";

type Phase =
  | { name: "ready"; error?: string }
  | { name: "starting" }
  // The game the server started, which decides what is shown.
  | { name: "playing"; attemptId: string; position: number; challengeType: ChallengeType; params: unknown; passTarget: number }
  | { name: "checking" }
  // Between games: this game's verdict and the day so far, from the submit reply.
  | { name: "between"; position: number; challengeType: ChallengeType; verdict: Verdict; day: DayProgress }
  // The server knows a state this page does not; router.refresh() is fetching it.
  | { name: "refreshing"; notice?: string }
  | { name: "failed"; heading: string; message: string };

// The refresh brought nothing new.
const STALE: Phase = {
  name: "failed",
  heading: "Reload the page",
  message: "Your day's latest state could not be loaded. Reload the page to see it.",
};

/** What a fresh `initial` from the server means for the phase on screen (T69). */
function afterServerUpdate(phase: Phase): Phase {
  // A refresh must never unmount a run, a result being checked, a start in flight or a verdict.
  if (["playing", "checking", "starting", "between"].includes(phase.name)) return phase;
  return { name: "ready", error: phase.name === "refreshing" ? phase.notice : undefined };
}

/** The game a Start would begin, or null once all of them have started. */
function nextGame(day: TodaysDay, firstGame: ChallengeType): { position: number; type: ChallengeType } | null {
  if (day.nextPosition === null) return null;
  // No lineup yet means nobody has started today, so the next game is the first.
  const type = day.games.find((game) => game.position === day.nextPosition)?.challengeType ?? firstGame;
  return isChallengeType(type) ? { position: day.nextPosition, type } : null;
}

/**
 * Today's Daily Three: the lineup with each game's status, Start for the next game with the seed
 * the server issued, then the server's verdict and the day so far. Reloading resumes from the
 * server's state; the client only sends its inputs, and the server scores them.
 * `firstGame` is the lineup's first game, for the how-to before the day exists.
 */
export function PlayToday({ firstGame, initial }: { firstGame: ChallengeType; initial: TodaysDay }) {
  const router = useRouter();
  const [current, setPhase] = useState<Phase>({ name: "ready" });
  const [refreshPending, startRefresh] = useTransition();

  // Each server refresh passes a new `initial`: follow it, except mid-run (T69).
  const [day, setDay] = useState(initial);
  if (initial !== day) {
    setDay(initial);
    setPhase(afterServerUpdate(current));
  }

  // The refresh finished without a new `initial`: say so rather than spin forever.
  const phase = current.name === "refreshing" && !refreshPending ? STALE : current;

  function refreshFromServer(notice?: string) {
    setPhase({ name: "refreshing", notice });
    startRefresh(() => router.refresh());
  }

  async function start() {
    setPhase({ name: "starting" });
    try {
      const response = await fetch("/api/attempts/start", { method: "POST" });
      const outcome = startOutcome(response.status, (await response.json()) as StartBody);
      if (outcome.name === "refresh") return refreshFromServer(outcome.notice);
      setPhase(outcome);
    } catch {
      // Offline, or not JSON: offer Start again.
      setPhase({ name: "ready", error: START_FAILED });
    }
  }

  async function submit({ attemptId, position, challengeType }: Extract<Phase, { name: "playing" }>, inputs: unknown) {
    setPhase({ name: "checking" });
    try {
      const response = await fetch("/api/attempts/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, inputs }),
      });
      const outcome = submitOutcome((await response.json()) as SubmitBody);
      if (outcome.name === "refresh") return refreshFromServer();
      setPhase(outcome.name === "result" ? { ...outcome, name: "between", position, challengeType } : outcome);
    } catch {
      setPhase({ name: "failed", ...SUBMIT_FAILED });
    }
  }

  // After a game, the day is reloaded from the server, which also shows what another tab did.
  const continueButton = <Button onClick={() => refreshFromServer()}>Continue</Button>;
  const seeResults = (variant?: "secondary") => (
    <LinkButton href={RESULTS_PATH} variant={variant}>
      See results
    </LinkButton>
  );

  switch (phase.name) {
    case "playing":
      return challengeUi(phase.challengeType).play({
        params: phase.params,
        passTarget: phase.passTarget,
        onFinish: (inputs) => submit(phase, inputs),
      });

    case "checking":
    case "refreshing":
      return (
        <div className={styles.checking}>
          <Spinner label={phase.name === "checking" ? "Checking your result" : "Loading your day"} visibleLabel />
        </div>
      );

    case "between": {
      const { position, challengeType, verdict, day: progress } = phase;
      // This game brought its side to two (a game left earlier is already one of the losses).
      const decidedNow = progress.outcome !== null && (verdict.passed ? progress.wins : progress.losses) === 2;
      return (
        <ResultHero
          score={verdict.score}
          heading={`Game ${position} of ${GAMES_PER_DAY}: ${verdict.passed ? "won" : "lost"}`}
          tone={verdict.passed ? "pass" : "plain"}
          // The pass that just decided the day is the one worth celebrating.
          confetti={decidedNow && progress.outcome === "passed"}
          note={`The day so far: ${daySoFar(progress)}.`}
          actions={progress.nextPosition === null ? seeResults() : continueButton}
        >
          <p className={styles.summary}>{challengeUi(challengeType).summary(verdict.score, verdict.passTarget)}</p>
          {decidedNow && <p className={styles.verdict}>{dayVerdict(progress.outcome)}</p>}
        </ResultHero>
      );
    }

    case "failed":
      return (
        <ResultHero heading={phase.heading} actions={continueButton}>
          <p role="alert">{phase.message}</p>
        </ResultHero>
      );

    default: {
      const next = nextGame(day, firstGame);
      const verdict = dayVerdict(day.outcome);
      const left = day.games.filter((game) => game.status === "in-progress");
      return (
        <>
          {day.games.length > 0 && <DayGames games={day.games} />}
          <Surface>
            {verdict && <h2 className={styles.verdict}>{verdict}</h2>}
            {day.games.length > 0 && <p>The day so far: {daySoFar(day)}.</p>}
            {left.map((game) => (
              <p key={game.position}>{unfinishedNote(game.position)}</p>
            ))}
            {next && (
              <>
                <h2>
                  Game {next.position} of {GAMES_PER_DAY}: {CHALLENGE_NAMES[next.type]}
                </h2>
                {verdict && <p>Your day is decided, so this game won&apos;t change the result. You can still play it.</p>}
                <p>{challengeUi(next.type).howTo}</p>
                <p>
                  Win two of the three games to pass the day. Each game is scored once: pressing Start uses it, and if you
                  leave before you finish, it counts as lost.
                </p>
                {phase.name === "ready" && phase.error && (
                  <p role="alert" className={styles.error}>
                    {phase.error}
                  </p>
                )}
                <Button onClick={start} loading={phase.name === "starting"}>
                  {verdict ? "Play it anyway" : "Start"}
                </Button>
                {/* Gone once Start is pressed: leaving after the server creates the game would lose it. */}
                {phase.name === "ready" && (
                  <Link href={challengeUi(next.type).practicePath} className={styles.practice}>
                    Practice first
                  </Link>
                )}
              </>
            )}
            {verdict && seeResults(next ? "secondary" : undefined)}
          </Surface>
        </>
      );
    }
  }
}
