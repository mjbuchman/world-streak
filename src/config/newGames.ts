/**
 * Games playable in practice before they are registered as challenges (M9 phase 1, T245): not in
 * CHALLENGE_TYPES, the registry or the daily pool. The practice hub lists them marked "New" so the
 * owner can try them. Each moves to `src/config/challenges.ts` when it is registered (phase 2).
 */
export const NEW_GAMES = [
  {
    name: "Ink",
    path: "/practice/ink",
    tagline: "40 colour words in a row: tap the colour of the ink, not the word. Slow and wrong answers drain your time bank.",
  },
] as const;

export const INK = NEW_GAMES[0];
