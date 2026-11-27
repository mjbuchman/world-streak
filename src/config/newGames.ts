/**
 * Games playable in practice before they are registered as challenges (M9 phase 1, T245): not in
 * CHALLENGE_TYPES, the registry or the daily pool. The practice hub lists them marked "New" so the
 * owner can try them. Each moves to `src/config/challenges.ts` when it is registered (phase 2).
 * Empty since Confusing Colors was registered (T239).
 */
export const NEW_GAMES: readonly { name: string; path: string; tagline: string }[] = [];
