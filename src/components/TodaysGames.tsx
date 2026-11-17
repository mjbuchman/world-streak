import Link from "next/link";
import type { ChallengeType } from "@/challenges/shared/types";
import { LinkButton } from "@/components/ui/LinkButton";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES, practicePath } from "@/config/challenges";
import { GAME_PITCH } from "@/config/game";
import styles from "./TodaysGames.module.css";

/** How the signed-in player stands with a game; "to-play" for everyone else. */
export type HomeGameStatus = "won" | "lost" | "to-play";
export type HomeGame = { challengeType: ChallengeType; status: HomeGameStatus };

const LABELS: Record<HomeGameStatus, string> = { won: "Won", lost: "Lost", "to-play": "To play" };

/**
 * The home page's "Your part today" card (T160): today's games in order with the player's progress,
 * Play, and practice for the next game to play.
 */
export function TodaysGames({ games }: { games: HomeGame[] }) {
  const next = games.find((game) => game.status === "to-play") ?? games[0];
  return (
    <Surface as="section" aria-labelledby="todays-games">
      <p className={styles.eyebrow}>Your part today</p>
      <h2 id="todays-games" className={styles.title}>
        Today&apos;s three games
      </h2>
      <p>{GAME_PITCH}</p>
      <ol className={styles.games}>
        {games.map((game) => (
          <li key={game.challengeType} className={styles.game} data-status={game.status}>
            <span>{CHALLENGE_NAMES[game.challengeType]}</span>
            <span className={styles.status}>{LABELS[game.status]}</span>
          </li>
        ))}
      </ol>
      <LinkButton href="/play">Play</LinkButton>
      {next && (
        <Link href={practicePath(next.challengeType)} className={styles.practice}>
          Practice first
        </Link>
      )}
      <Link href="/practice" className={styles.practiceAll}>
        Practice any challenge
      </Link>
    </Surface>
  );
}
