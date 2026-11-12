// The prize for a cycle: the flat base plus what rolled in from cycles nobody won.

/** The prize-relevant part of a `cycles` row. */
export type Cycle = {
  baseCents: number;
  rolloverInCents: number;
  /** When the world streak reached the goal inside the cycle (a game date), or null. */
  goalReachedOn: string | null;
};

export function currentPrizeCents(cycle: Cycle): number {
  return cycle.baseCents + cycle.rolloverInCents;
}

/** What rolls into the next cycle: nothing once this one was won, otherwise its whole prize. */
export function nextRolloverCents(cycle: Cycle): number {
  return cycle.goalReachedOn ? 0 : currentPrizeCents(cycle);
}
