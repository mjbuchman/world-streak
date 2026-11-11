import type { ChallengeType } from "@/challenges/shared/types";

/**
 * What players see each challenge called. Original names, not those of existing games
 * (DESIGN.md); see docs/DECISIONS.md.
 */
export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  stacking: "Teetering Tower",
  "inner-clock": "Second Sense",
  "flash-count": "Swift Sum",
};

/** How to play Second Sense: shown before a practice run (and later before a scored attempt). */
export const INNER_CLOCK_HOW_TO =
  "Press Start, then tap when you think the target time has passed. There is no clock to watch: count in your head. The closer you are, the better.";

/** How to play Swift Sum: shown before a practice run (and later before a scored attempt). */
export const FLASH_COUNT_HOW_TO =
  "Press Start and dots flash on the board for one second. Then enter how many you think there were. The closer you are, the better.";

/** How to play the Tower: shown before a practice run and before today's scored attempt. */
export const STACKING_HOW_TO =
  "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower.";
