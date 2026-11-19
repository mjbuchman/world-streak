"use client";

import { useEffect, useRef, useState } from "react";

export type RoundPhase = "countdown" | "round" | "reveal";

type RevealRoundsOptions<Entry, Inputs> = {
  /** The engine's inputs for the entries so far. */
  toInputs: (entries: Entry[]) => Inputs;
  /** The engine's say on whether the run is over. */
  isFinished: (inputs: Inputs) => boolean;
  /** How long each round's result shows before the next 3-2-1 (or the end). */
  revealMs: number;
  onFinish: (inputs: Inputs) => void;
};

/**
 * The round loop Swift Sum and Second Sense share (T200): a 3-2-1, the round, then its result for
 * `revealMs`, again until the engine says the run is over. Every result, the last one too, shows
 * in full: ending the run only after it means a phone's click, which follows the tap, lands on the
 * result rather than the result screen's "Play again".
 */
export function useRevealRounds<Entry, Inputs>({ toInputs, isFinished, revealMs, onFinish }: RevealRoundsOptions<Entry, Inputs>) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<RoundPhase>("countdown");
  const inputs = toInputs(entries);
  const finished = isFinished(inputs);

  // The latest callback and inputs, so the reveal's timer is not restarted by a re-render.
  const finishRef = useRef(onFinish);
  const inputsRef = useRef(inputs);
  useEffect(() => {
    finishRef.current = onFinish;
    inputsRef.current = inputs;
  });

  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(() => (finished ? finishRef.current(inputsRef.current) : setPhase("countdown")), revealMs);
    return () => clearTimeout(timer);
  }, [phase, finished, revealMs]);

  const record = (entry: Entry) => {
    setEntries((previous) => [...previous, entry]);
    setPhase("reveal");
  };
  const startRound = () => setPhase("round");

  return { entries, inputs, phase, record, startRound };
}

/**
 * RoundProgress's props after `played` rounds: the round being played, or the last once all are
 * played. A failed run stays on the round that failed; later rounds were never played.
 */
export function progressAt(played: number, total: number, { survived, failed }: { survived: number; failed: boolean }) {
  return { total, current: failed ? survived : Math.min(played, total - 1), failedRound: failed ? survived : undefined };
}
