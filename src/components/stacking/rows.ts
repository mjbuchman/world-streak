// The Tower's result speaks in rows, like the HUD ("Row 10 to pass"): the human's decision at
// the second play-test. The score is the number of rows locked, so it is also the row reached.

/** "You reached row 7". A score of 0 only exists in attempts stored before T87. */
export function reachedRow(score: number): string {
  return score > 0 ? `You reached row ${score}` : "You didn't stack a row";
}

/** "row 10": today's target row, a fractional target rounded up as the HUD does. */
export function targetRow(passTarget: number): string {
  return `row ${Math.ceil(passTarget)}`;
}
