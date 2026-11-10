/** A game day as the start, submit and play flows read it. */
export type GameDay = { challengeType: string; passTarget: number; closed: boolean };

/** A player's attempt for one game date: still open, or submitted with its stored result. */
export type DayAttempt = { submitted: false } | { submitted: true; score: number; passed: boolean; passTarget: number };
