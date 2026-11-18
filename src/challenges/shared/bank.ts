/**
 * The bank rule shared by the round-based games (T180): each round has a cost; a round survives if
 * its cost is at most what is left of the bank, which then goes down by the cost. The run ends at
 * the first round that does not survive, or after the last round. A cost exactly equal to what is
 * left survives (DECISIONS, T198).
 */

/** Decimal costs drift when summed (0.1 + 0.2 > 0.3), so a cost this close to the bank still fits. */
const EPSILON = 1e-9;

export type BankResult = { survived: number; left: number; failed: boolean };

export function playBank(total: number, costs: readonly number[]): BankResult {
  let left = total;
  for (let i = 0; i < costs.length; i++) {
    if (costs[i] > left + EPSILON) return { survived: i, left: 0, failed: true };
    left = Math.max(0, left - costs[i]);
  }
  return { survived: costs.length, left, failed: false };
}

/** Rounds survived plus the bank left as a fraction of the bank, to 3 decimals. */
export function bankScore(survived: number, left: number, total: number): number {
  return Math.round((survived + left / total) * 1000) / 1000;
}
