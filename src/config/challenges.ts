import type { ChallengeType } from "@/challenges/shared/types";

/**
 * What players see each challenge called. Original names, not those of existing games
 * (DESIGN.md); see docs/DECISIONS.md.
 */
export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  stacking: "Teetering Tower",
  "inner-clock": "Second Sense",
  "flash-count": "Swift Sum",
  "echo-path": "Trail Trace",
  "fair-split": "Clean Cut",
  // The owner named it (T258); the code name stays `ink`.
  ink: "Confusing Colors",
};

/** One line on each challenge, for the home card and the practice hub. */
export const CHALLENGE_TAGLINES: Record<ChallengeType, string> = {
  stacking: "Stack the sliding rows as high as you can.",
  "inner-clock": "Four rounds: tap when each target time has passed. Targets of 10 to 20 seconds; every miss drains your 4-second time bank.",
  "flash-count": "Five rounds of 10 to 25 dots, a new count every round: say how many. Every dot you miss drains your 10-dot bank.",
  "echo-path": "A path of up to 12 tiles climbs the board. Tap it back, one tile longer each time, all the way to the top, with one extra life.",
  "fair-split": "Five irregular blobs and polygons: place one straight line to cut each in half. Every point off 50% drains your 8-point bank.",
  ink: "30 colour words in a row: tap the colour of the ink, not the word. Slow and wrong answers drain your time bank.",
};

/** Each challenge's practice page (the route folders are named after the types). */
export function practicePath(type: ChallengeType): string {
  return `/practice/${type}`;
}

/** How to play Second Sense: shown before a practice run (and later before a scored attempt). */
export const INNER_CLOCK_HOW_TO =
  "Press Start for four rounds. In each, tap when you think its target time (10 to 20 seconds) has passed. A clock counts the first 2 seconds, then hides: keep counting in your head. Each round's miss comes out of one 4-second time bank; the run ends when a miss is bigger than what is left. Survive all four to pass.";

/** How to play Swift Sum: shown before a practice run (and later before a scored attempt). */
export const FLASH_COUNT_HOW_TO =
  "Press Start for five rounds. In each, dots flash on the board: enter how many you think there were. Each round has a new count of 10 to 25 dots, and a shorter flash. Every dot you are off by comes out of one 10-dot bank; the run ends when a miss is bigger than what is left. Survive all five to pass.";

/** How to play Echo Path: shown before a practice run and before a scored attempt. */
export const ECHO_PATH_HOW_TO =
  "Press Start and watch: a path of 4 tiles lights up from the bottom of the board. Then tap them back in the same order, or move with the arrow keys and press Space or Enter. Each path you repeat adds its next tile, until it reaches the top: a path of up to 12 tiles. You have one extra life: the first wrong tile costs it and shows the same path again, and a second ends the run.";

/** How to play Fair Split: shown before a practice run and before a scored attempt. */
export const FAIR_SPLIT_HOW_TO =
  "Press Start for five shapes, irregular blobs and polygons, each one lopsided, with no mirror to guide you. A line crosses each one: drag its ends or the line itself (or use the arrow keys, and [ and ] to turn it) until you think it cuts the shape in half, then press Cut or Enter. You have 25 seconds a shape, shown by the ring; when it runs out, the line is cut where it is. Every point a cut is off 50% comes out of one 8-point bank; the run ends when a cut is off by more than what is left. Survive all five to pass.";

/** How to play Confusing Colors: shown before a practice run and before a scored attempt. */
export const INK_HOW_TO =
  "Tap the colour of the ink, not the word. Keys 1 to 4 also work. Press Start for 30 colour words in a row. Wrong, slow and missed answers drain one 3.2 s time bank; more and more words disagree with their ink. Survive all 30 words.";

/** How to play the Tower: shown before a practice run and before today's scored attempt. */
export const STACKING_HOW_TO =
  "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower.";
