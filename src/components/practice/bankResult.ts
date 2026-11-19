type BankResultArgs = {
  survived: number;
  total: number;
  /** The heading for a run that survived every round, e.g. "Every shape survived". */
  everyLabel: string;
  /** The game's score label, e.g. "2 rounds". */
  scoreLabel: (survived: number) => string;
  /** What was left of the bank, in the game's unit. */
  left: number;
  format: (left: number) => string;
  /** The bank as players read it, e.g. "10-dot bank". */
  bankLabel: string;
  score: number;
};

/**
 * The practice result for a run against a bank (T200): how far it got, and the bank left and the
 * score as the engine counts them. Swift Sum, Second Sense and Clean Cut share it; Trail Trace
 * counts lives and the longest path instead.
 */
export function bankResult({ survived, total, everyLabel, scoreLabel, left, format, bankLabel, score }: BankResultArgs) {
  const heading = survived === total ? everyLabel : `${scoreLabel(survived)} survived`;
  return { heading, detail: `${format(left)} of your ${bankLabel} left. Score: ${score}.` };
}
