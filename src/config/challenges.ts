import type { ChallengeType } from "@/challenges/shared/types";

/**
 * What players see each challenge called. Original names, not those of existing games
 * (DESIGN.md); see docs/DECISIONS.md.
 */
export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  stacking: "Teetering Tower",
  "inner-clock": "Second Sense",
};

/** How to play the Tower: shown before a practice run and before today's scored attempt. */
export const STACKING_HOW_TO =
  "A row of blocks slides across the board. Tap, click or press Space to lock it over the row below. Blocks that hang over the edge fall off, so the tower gets narrower.";
