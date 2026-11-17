import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { practicePath } from "@/config/challenges";
import { todaysChallenge, todaysDay } from "@/lib/attempts/today";
import { landingPath } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlayToday } from "./PlayToday";
import styles from "./play.module.css";

const PLAY_TITLE = "Today's games";
export const metadata: Metadata = { title: PLAY_TITLE };

/**
 * Today's Daily Three, game by game (T156); the ad slot is on the results page (T157), never
 * here. Signed-out visitors are pointed to sign-in and practice.
 */
export default async function PlayPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  const challenge = await todaysChallenge(supabase, new Date());

  if (!userId) {
    return (
      <PageShell title={PLAY_TITLE} backHref="/">
        <Surface>
          <p>Sign in to play today&apos;s three games.</p>
          <div className={styles.actions}>
            <LinkButton href="/signin">Sign in</LinkButton>
            <LinkButton href={practicePath(challenge)} variant="secondary">
              Practice
            </LinkButton>
          </div>
        </Surface>
      </PageShell>
    );
  }

  // A scored game needs eligibility details (the start endpoint refuses without them too).
  if ((await landingPath(supabase, userId)) === "/complete-profile") redirect("/complete-profile");
  const day = await todaysDay(supabase, userId, new Date());

  return (
    <PageShell title={PLAY_TITLE} backHref="/">
      {/* Not keyed: PlayToday follows a refreshed day itself, and never mid-run (T69). */}
      <PlayToday firstGame={challenge} initial={day} />
    </PageShell>
  );
}
