/**
 * Games playable in practice before they are registered as challenges (M9 phase 1, T245): not in
 * CHALLENGE_TYPES, the registry or the daily pool. The practice hub lists them marked "New" so the
 * owner can try them. Each moves to `src/config/challenges.ts` when it is registered (phase 2).
 */
export const NEW_GAMES = [
  {
    name: "Bank Shot",
    path: "/practice/bank-shot",
    tagline: "Five shots: watch a puck bounce off the walls, then mark where it will cross the finish line. Close enough costs nothing; every unit further out drains your 30-unit bank.",
  },
  {
    name: "Ink",
    path: "/practice/ink",
    tagline: "Five rounds of eight colour words: tap the colour of the ink, not the word. Slow and wrong answers drain your time bank.",
  },
] as const;

export const BANK_SHOT = NEW_GAMES[0];
export const INK = NEW_GAMES[1];
