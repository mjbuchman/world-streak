import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Meter } from "@/components/Meter";
import { WorldStreak } from "@/components/WorldStreak";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import styles from "./page.module.css";

/**
 * Home: the live meter is the star (T104), then today's challenge, then the world streak. The
 * header bar above already shows the wordmark, so the page's h1 is for screen readers only.
 */
export default function Home() {
  return (
    <PageShell>
      <header className={styles.top}>
        <h1 className="visually-hidden">{GAME_NAME}</h1>
        <Countdown />
      </header>
      <Meter />
      <Surface as="section" aria-labelledby="todays-challenge">
        <p className={styles.eyebrow}>Your part today</p>
        <h2 id="todays-challenge" className={styles.challenge}>
          {CHALLENGE_NAMES.stacking}
        </h2>
        <p className={styles.challengeText}>Stack as high as you can. One scored try a day.</p>
        <LinkButton href="/play">Play today&apos;s challenge</LinkButton>
        <Link href="/practice/stacking" className={styles.practice}>
          Practice first
        </Link>
      </Surface>
      <WorldStreak />
    </PageShell>
  );
}
