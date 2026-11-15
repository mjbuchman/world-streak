/** An inclusive range of values for one round. */
export type RoundRange = { min: number; max: number };

/**
 * The ranges of a multi-round game whose rounds get harder by a fixed step: round i runs from
 * `start + step × i` to `width` above that. A step larger than the width keeps every round's
 * range above the last, so the drawn values always rise.
 */
export function ladderRanges(rounds: number, start: number, step: number, width: number): readonly RoundRange[] {
  return Array.from({ length: rounds }, (_, i) => ({ min: start + step * i, max: start + step * i + width }));
}
