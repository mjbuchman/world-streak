import Link from "next/link";
import { Meter } from "@/components/Meter";
import { WorldStreak } from "@/components/WorldStreak";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME, GAME_PITCH } from "@/config/game";
import styles from "./page.module.css";

/** Home: the game, its pitch, today's challenge front and centre, the live meter and the world streak. */
export default function Home() {
  return (
    <PageShell>
      <div className={styles.intro}>
        <h1 className={styles.title}>{GAME_NAME}</h1>
        <p className={styles.pitch}>{GAME_PITCH}</p>
      </div>
      <Surface as="section" tone="highlight" aria-labelledby="todays-challenge">
        <p className={styles.eyebrow}>Today&apos;s challenge</p>
        <h2 id="todays-challenge" className={styles.challenge}>
          {CHALLENGE_NAMES.stacking}
        </h2>
        <p className={styles.challengeText}>Stack as high as you can. One scored try a day.</p>
        <LinkButton href="/play">Play today&apos;s challenge</LinkButton>
        <Link href="/practice/stacking" className={styles.practice}>
          Practice first
        </Link>
      </Surface>
      <Meter />
      <WorldStreak />
    </PageShell>
  );
}
