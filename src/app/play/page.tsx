import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import { todaysAttempt } from "@/lib/attempts/today";
import { landingPath } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlayToday } from "./PlayToday";
import styles from "./play.module.css";

export const metadata: Metadata = { title: `Today's challenge | ${GAME_NAME}` };

/**
 * Today's scored attempt. Signed-out visitors are pointed to sign-in and practice. Stacking is
 * the only challenge until T30 adds the others and picks each day's from the game day.
 */
export default async function PlayPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Today&apos;s challenge: {CHALLENGE_NAMES.stacking}</h1>
        <p>Sign in to play today&apos;s scored attempt.</p>
        <div className={styles.links}>
          <Link href="/signin" className={styles.link}>
            Sign in
          </Link>
          <Link href="/practice/stacking" className={styles.link}>
            Practice
          </Link>
        </div>
      </main>
    );
  }

  // A scored attempt needs eligibility details (the start endpoint refuses without them too).
  if ((await landingPath(supabase, userId)) === "/complete-profile") redirect("/complete-profile");
  const status = await todaysAttempt(supabase, userId, new Date());

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Today&apos;s challenge: {CHALLENGE_NAMES.stacking}</h1>
      {/* Keyed on the status, so a refresh after a submission elsewhere shows the new state. */}
      <PlayToday key={status.kind} initial={status} />
    </main>
  );
}
