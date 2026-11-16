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
  "inner-clock": "Tap when each target time has passed. Every miss drains your time bank.",
  "flash-count": "Dots flash for a moment. Say how many there were.",
  "echo-path": "Tiles light up in a path. Tap it back, one step longer each time.",
  "fair-split": "Cut each odd shape in half with one straight line, before time runs out.",
};

/** Each challenge's practice page (the route folders are named after the types). */
export function practicePath(type: ChallengeType): string {
  return `/practice/${type}`;
}

/** How to play Second Sense: shown before a practice run (and later before a scored attempt). */
export const INNER_CLOCK_HOW_TO =
  "Press Start, then tap when you think each round's target time has passed. A clock counts the first moment, then hides: keep counting in your head. Each round's miss comes out of a 3-second time bank; the run ends when a miss is bigger than what is left. Survive as many rounds as you can.";

/** How to play Swift Sum: shown before a practice run (and later before a scored attempt). */
export const FLASH_COUNT_HOW_TO =
  "Press Start and dots flash on the board. Enter how many you think there were: close enough clears the level, and each level has more dots and a shorter flash. You have 3 lives; a miss costs one and replays the same level with new dots. Clear as many levels as you can.";

/** How to play Echo Path: shown before a practice run and before a scored attempt. */
export const ECHO_PATH_HOW_TO =
  "Press Start and watch: tiles on the grid light up one after another. Then tap them back in the same order, or press 1 to 9 for them row by row. Each path you repeat adds a step. You have 3 lives; a wrong tile costs one and gives you a new path of the same length.";

/** How to play Fair Split: shown before a practice run and before a scored attempt. */
export const FAIR_SPLIT_HOW_TO =
  "Press Start and a shape appears. Drag one straight line across it to cut it in half: within 1 point of 50% on each side counts. Each shape has a time limit, shown by the ring. You have 3 lives; a cut that is off, or no cut in time, costs one and brings the shape back. Cut as many shapes as you can.";

/** How to play the Tower: shown before a practice run and before today's scored attempt. */
export const STACKING_HOW_TO =
  "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower.";
