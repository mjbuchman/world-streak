import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Meter } from "@/components/Meter";
import { PrizeCycle } from "@/components/PrizeCycle";
import { WorldStreak } from "@/components/WorldStreak";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES, CHALLENGE_TAGLINES, practicePath } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import { DEFAULT_CHALLENGE, todaysChallenge } from "@/lib/attempts/today";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

/**
 * Home: the live meter is the star (T104), then today's challenge, then the world streak. The
 * header bar above already shows the wordmark, so the page's h1 is for screen readers only.
 */
export default async function Home() {
  // Outside the try: reading the request cookies is how Next.js learns the page is dynamic.
  const db = await createSupabaseServerClient();
  // A failed read shows the default challenge rather than an error page; /play reads it again.
  let challenge = DEFAULT_CHALLENGE;
  try {
    challenge = await todaysChallenge(db, new Date());
  } catch (error) {
    console.error(error);
  }
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
          {CHALLENGE_NAMES[challenge]}
        </h2>
        <p className={styles.challengeText}>{`${CHALLENGE_TAGLINES[challenge]} One scored try a day.`}</p>
        <LinkButton href="/play">Play today&apos;s challenge</LinkButton>
        <Link href={practicePath(challenge)} className={styles.practice}>
          Practice first
        </Link>
        <Link href="/practice" className={styles.practiceAll}>
          Practice any challenge
        </Link>
      </Surface>
      <PrizeCycle />
      <WorldStreak />
    </PageShell>
  );
}
