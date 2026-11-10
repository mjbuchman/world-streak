// The Tower's result speaks in rows, like the HUD ("Row 10 to pass"): the human's decision at
// the second play-test. The score is the number of rows locked, so it is also the row reached.

/** "You reached row 7". A score of 0 only exists in attempts stored before T87. */
export function reachedRow(score: number): string {
  return score > 0 ? `You reached row ${score}` : "You didn't stack a row";
}

/**
 * The row to reach for today's target. pass_target is numeric, so a fractional target (10.2)
 * means reaching the next whole row (11). Shared by the HUD and the result, so they agree.
 */
export function targetRowNumber(passTarget: number): number {
  return Math.ceil(passTarget);
}

/** "row 10": today's target row. */
export function targetRow(passTarget: number): string {
  return `row ${targetRowNumber(passTarget)}`;
}
