"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ResultHero } from "@/components/ui/ResultHero";
import { Surface } from "@/components/ui/Surface";
import styles from "./PracticeShell.module.css";

/** What a finished practice run shows: the heading, and optionally a big score and a line. */
export type PracticeResult = { heading: string; score?: number; detail?: string };

type PracticeShellProps<Params, Inputs> = {
  /** How to play, from the challenge's UI entry; "Practice never counts." follows it. */
  howTo: string;
  /** A fresh instance for each run. */
  newRun: () => Params;
  /** The game for one run; it calls `onFinish` once with the run's inputs. */
  game: (params: Params, onFinish: (inputs: Inputs) => void) => ReactNode;
  result: (params: Params, inputs: Inputs) => PracticeResult;
  /**
   * A line about the next run to show before it starts (Second Sense's target), or null while it
   * cannot be shown yet; the line keeps its space either way.
   */
  preview?: (params: Params) => string | null;
  /** Keeps Start off, for example until the page runs in the browser. */
  startDisabled?: boolean;
};

type Phase<Params, Inputs> =
  | { name: "ready"; params: Params }
  | { name: "playing"; params: Params }
  | { name: "done"; params: Params; inputs: Inputs };

/**
 * The practice page around any challenge (T109): how to play and Start, the game, then the result
 * with Play again. Practice never counts, so each run's seed comes from the browser.
 */
export function PracticeShell<Params, Inputs>({ howTo, newRun, game, result, preview, startDisabled }: PracticeShellProps<Params, Inputs>) {
  const [phase, setPhase] = useState<Phase<Params, Inputs>>(() => ({ name: "ready", params: newRun() }));
  const finish = (inputs: Inputs) =>
    setPhase((current) => (current.name === "playing" ? { name: "done", params: current.params, inputs } : current));

  if (phase.name === "playing") return game(phase.params, finish);

  if (phase.name === "done") {
    const shown = result(phase.params, phase.inputs);
    return (
      <ResultHero
        score={shown.score}
        heading={shown.heading}
        tone="practice"
        note="Practice never counts. Play as often as you like."
        actions={
          <>
            <Button onClick={() => setPhase({ name: "playing", params: newRun() })}>Play again</Button>
            <LinkButton href="/" variant="secondary">
              Back to home
            </LinkButton>
          </>
        }
      >
        {shown.detail && <p>{shown.detail}</p>}
      </ResultHero>
    );
  }

  return (
    <Surface>
      <p>{`${howTo} Practice never counts.`}</p>
      {preview && <p className={styles.preview}>{preview(phase.params) ?? " "}</p>}
      <Button disabled={startDisabled} onClick={() => setPhase({ name: "playing", params: phase.params })}>
        Start
      </Button>
    </Surface>
  );
}
