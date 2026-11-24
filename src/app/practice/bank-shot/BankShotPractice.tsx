"use client";

import { BANK_UNITS, FREE_UNITS, paramsFromSeed, play, ROUNDS, type BankShotInputs, type BankShotParams } from "@/challenges/bank-shot/engine";
import { oneDecimal } from "@/challenges/bank-shot/render";
import { BankShotGame } from "@/components/bank-shot/BankShotGame";
import { bankResult } from "@/components/practice/bankResult";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { secureRandomSeed } from "@/lib/random";

/** The how-to lives here until Bank Shot is registered as a challenge (T234, phase 2). */
const BANK_SHOT_HOW_TO =
  `Press Start for ${ROUNDS} shots. Each round a puck launches up the board and bounces off the walls, ` +
  "then vanishes before it reaches the finish line. Tap or drag on the board to put your marker where it will cross, " +
  `then press Lock in or Enter. A guess within ${FREE_UNITS} units of the crossing costs nothing; ` +
  `every unit further out drains one ${BANK_UNITS}-unit bank. Later rounds bounce more, ` +
  "show less and add a spinning bumper. Survive all five.";

const shots = (n: number) => `${n} ${n === 1 ? "shot" : "shots"}`;
const newRun = () => paramsFromSeed(secureRandomSeed());

/** The result: the shots survived and the bank left, as the engine counts them (T245). */
function result(params: BankShotParams, inputs: BankShotInputs) {
  return bankResult({
    ...play(params, inputs),
    total: params.rounds.length,
    everyLabel: "Every shot survived",
    scoreLabel: shots,
    format: (left) => `${oneDecimal(left)} ${left === 1 ? "unit" : "units"}`,
    bankLabel: `${params.bank}-unit bank`,
  });
}

export function BankShotPractice() {
  return (
    <PracticeShell<BankShotParams, BankShotInputs>
      howTo={BANK_SHOT_HOW_TO}
      newRun={newRun}
      game={(params, onFinish) => <BankShotGame params={params} onFinish={onFinish} />}
      result={result}
    />
  );
}
