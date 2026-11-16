/** One game of a day's lineup (`game_day_games`), with the target it is judged against. */
export type LineupGame = { position: number; challengeType: string; passTarget: number };

/** A game day as the start, submit and play flows read it: its lineup in order, and whether it closed. */
export type GameDay = { closed: boolean; games: LineupGame[] };

/** A player's attempt at one game of the day: still open, or submitted with its stored result. */
export type GameAttempt = { position: number } & ({ submitted: false } | { submitted: true; score: number; passed: boolean });

/** A player's day (`day_results`): a started game counts as a loss until its pass is recorded. */
export type DayResult = { wins: number; losses: number; outcome: "passed" | "failed" | null };

/** The next game to start (1 to 3), or null once every game of the lineup has started. */
export function nextPosition(day: GameDay, attempts: GameAttempt[]): number | null {
  return attempts.length < day.games.length ? attempts.length + 1 : null;
}
