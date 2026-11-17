import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { Meter } from "@/components/Meter";
import { ShareCard } from "@/components/ShareCard";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { todaysDay } from "@/lib/attempts/today";
import { isPerfectDay } from "@/lib/share";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DayGames } from "../DayGames";
import { daySoFar, dayVerdict, shareGame } from "../outcomes";
import styles from "../play.module.css";

const TITLE = "Today's results";
export const metadata: Metadata = { title: TITLE };

/**
 * The player's decided day (T157): the verdict, each game with its score and target, the meter
 * and the share card, then the ad slot (T44). Percentiles and score distributions are left out
 * until the design plans them (DECISIONS, T157). Before the day is decided it is /play's.
 */
export default async function ResultsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) {
    return (
      <PageShell title={TITLE} backHref="/">
        <Surface>
          <p>Sign in to see your results for today.</p>
          <div className={styles.actions}>
            <LinkButton href="/signin">Sign in</LinkButton>
          </div>
        </Surface>
      </PageShell>
    );
  }

  const day = await todaysDay(supabase, userId, new Date());
  const verdict = dayVerdict(day.outcome);
  if (!verdict) redirect("/play");
  const games = day.games.map((game) => shareGame(game.status));

  return (
    <PageShell title={TITLE} backHref="/">
      <Surface>
        <h2 className={styles.verdict}>{verdict}</h2>
        {/* A reason to play the last game (DECISIONS, T159); it changes nothing that is counted. */}
        {isPerfectDay(games) && <p className={styles.perfect}>Perfect day: all three games won</p>}
        <p>{daySoFar(day)}.</p>
        <DayGames games={day.games} withScores />
        <div className={styles.actions}>
          {/* The remaining game is still offered, though it cannot change the result. */}
          {day.nextPosition !== null && (
            <LinkButton href="/play" variant="secondary">
              Play the last game
            </LinkButton>
          )}
          <LinkButton href="/" variant="secondary">
            Back to home
          </LinkButton>
        </div>
      </Surface>
      {/* Spoiler-free, so sharing it gives nothing away (T32). */}
      <ShareCard passed={day.outcome === "passed"} games={games} />
      <Meter />
      <AdSlot name="play-result" />
    </PageShell>
  );
}
