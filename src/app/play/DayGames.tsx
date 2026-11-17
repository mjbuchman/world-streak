"use client";

import { isChallengeType } from "@/challenges/registry";
import { challengeUi } from "@/components/challenges/challengeUi";
import { CHALLENGE_NAMES } from "@/config/challenges";
import type { GameStatus } from "@/lib/attempts/today";
import { statusLabel } from "./outcomes";
import styles from "./play.module.css";

/** Each game's score against its target, or the target alone when it has no score. */
function detail(game: GameStatus): string {
  // The server refuses to start a challenge this build does not know, so this is a stale lineup.
  if (!isChallengeType(game.challengeType)) return "";
  const ui = challengeUi(game.challengeType);
  if ("score" in game) return ui.summary(game.score, game.passTarget);
  const target = `Today's target was ${ui.target(game.passTarget)}.`;
  return game.status === "in-progress" ? `Left before finishing. ${target}` : target;
}

/**
 * Today's games in order, each with its status (won, lost, not played). `withScores` adds each
 * game's score and target, for the results page (T157).
 */
export function DayGames({ games, withScores = false }: { games: GameStatus[]; withScores?: boolean }) {
  return (
    <ol className={styles.games} aria-label="Today's games">
      {games.map((game) => (
        <li key={game.position} className={styles.game} data-status={game.status}>
          <span className={styles.gameName}>
            Game {game.position}: {isChallengeType(game.challengeType) ? CHALLENGE_NAMES[game.challengeType] : game.challengeType}
          </span>
          <span className={styles.gameStatus}>{statusLabel(game.status)}</span>
          {withScores && <span className={styles.gameDetail}>{detail(game)}</span>}
        </li>
      ))}
    </ol>
  );
}
