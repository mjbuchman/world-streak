import type { ChallengeType } from "@/challenges/shared/types";

/**
 * What players see each challenge called. Original names, not those of existing games
 * (DESIGN.md); see docs/DECISIONS.md.
 */
export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  stacking: "Teetering Tower",
  "inner-clock": "Second Sense",
  "flash-count": "Swift Sum",
  "echo-path": "Echo Path",
  "fair-split": "Fair Split",
};

/** One line on each challenge, for the home card and the practice hub. */
export const CHALLENGE_TAGLINES: Record<ChallengeType, string> = {
  stacking: "Stack the sliding rows as high as you can.",
  "inner-clock": "Four rounds: tap when each target time has passed. Every miss drains your 10-second time bank.",
  "flash-count": "Five rounds: dots flash, say how many. Every dot you miss drains your 10-dot bank.",
  "echo-path": "A path of tiles climbs the board. Tap it back, one tile longer each time, all the way to the top.",
  "fair-split": "Cut each odd shape in half with one straight line, before time runs out.",
};

/** Each challenge's practice page (the route folders are named after the types). */
export function practicePath(type: ChallengeType): string {
  return `/practice/${type}`;
}

/** How to play Second Sense: shown before a practice run (and later before a scored attempt). */
export const INNER_CLOCK_HOW_TO =
  "Press Start for four rounds. In each, tap when you think its target time (15 to 25 seconds) has passed. A clock counts the first 2 seconds, then hides: keep counting in your head. Each round's miss comes out of one 10-second time bank; the run ends when a miss is bigger than what is left. Survive all four to pass.";

/** How to play Swift Sum: shown before a practice run (and later before a scored attempt). */
export const FLASH_COUNT_HOW_TO =
  "Press Start for five rounds. In each, dots flash on the board: enter how many you think there were. Each round has more dots and a shorter flash. Every dot you are off by comes out of one 10-dot bank; the run ends when a miss is bigger than what is left. Survive all five to pass.";

/** How to play Echo Path: shown before a practice run and before a scored attempt. */
export const ECHO_PATH_HOW_TO =
  "Press Start and watch: a path of 4 tiles lights up from the bottom of the board. Then tap them back in the same order, or move with the arrow keys and press Space or Enter. Each path you repeat adds its next tile, until it reaches the top. You have 3 lives; a wrong tile costs one and shows the same path again.";

/** How to play Fair Split: shown before a practice run and before a scored attempt. */
export const FAIR_SPLIT_HOW_TO =
  "Press Start and a shape appears. Drag one straight line across it to cut it in half: within 1 point of 50% on each side counts. Each shape has a time limit, shown by the ring. You have 3 lives; a cut that is off, or no cut in time, costs one and brings the shape back. Cut as many shapes as you can.";

/** How to play the Tower: shown before a practice run and before today's scored attempt. */
export const STACKING_HOW_TO =
  "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower.";
