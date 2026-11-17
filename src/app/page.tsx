import { isChallengeType } from "@/challenges/registry";
import { AdSlot } from "@/components/AdSlot";
import { Countdown } from "@/components/Countdown";
import { Meter } from "@/components/Meter";
import { PrizeCycle } from "@/components/PrizeCycle";
import { TodaysGames, type HomeGame } from "@/components/TodaysGames";
import { WorldStreak } from "@/components/WorldStreak";
import { PageShell } from "@/components/ui/PageShell";
import { GAME_NAME } from "@/config/game";
import { DEFAULT_CHALLENGE, todaysDay, todaysLineup, type GameStatus } from "@/lib/attempts/today";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// A game started and left counts as lost (T153), as on /play.
const HOME_STATUS: Record<GameStatus["status"], HomeGame["status"]> = {
  won: "won",
  lost: "lost",
  "in-progress": "lost",
  "not-started": "to-play",
};

/** Today's games with the signed-in player's progress; all to play before their day exists. */
async function homeGames(db: Db, userId: string | undefined, now: Date): Promise<HomeGame[]> {
  if (userId) {
    const day = await todaysDay(db, userId, now);
    // A game this build cannot name (a stale lineup) is left out rather than breaking the page.
    const games = day.games.flatMap(({ challengeType, status }): HomeGame[] =>
      isChallengeType(challengeType) ? [{ challengeType, status: HOME_STATUS[status] }] : [],
    );
    if (games.length > 0) return games;
  }
  return (await todaysLineup(db, now)).map((challengeType) => ({ challengeType, status: "to-play" }));
}

/**
 * Home: the live meter is the star (T104), then today's games, then the world streak. The
 * header bar above already shows the wordmark, so the page's h1 is for screen readers only.
 */
export default async function Home() {
  // Outside the try: reading the request cookies is how Next.js learns the page is dynamic.
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getClaims();
  // A failed read shows the default game rather than an error page; /play reads it again.
  let games: HomeGame[] = [{ challengeType: DEFAULT_CHALLENGE, status: "to-play" }];
  try {
    games = await homeGames(db, data?.claims.sub, new Date());
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
      <TodaysGames games={games} />
      <PrizeCycle />
      <WorldStreak />
      <AdSlot name="home" />
    </PageShell>
  );
}
