import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
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
  const title = CHALLENGE_NAMES.stacking;

  if (!userId) {
    return (
      <PageShell title={title} backHref="/">
        <Surface>
          <p>Sign in to play today&apos;s scored attempt.</p>
          <div className={styles.actions}>
            <LinkButton href="/signin">Sign in</LinkButton>
            <LinkButton href="/practice/stacking" variant="secondary">
              Practice
            </LinkButton>
          </div>
        </Surface>
      </PageShell>
    );
  }

  // A scored attempt needs eligibility details (the start endpoint refuses without them too).
  if ((await landingPath(supabase, userId)) === "/complete-profile") redirect("/complete-profile");
  const status = await todaysAttempt(supabase, userId, new Date());

  return (
    <PageShell title={title} backHref="/">
      {/* Keyed on the status, so a refresh after a submission elsewhere shows the new state. */}
      <PlayToday key={status.kind} initial={status} />
    </PageShell>
  );
}
