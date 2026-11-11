import Link from "next/link";
import { Surface } from "@/components/ui/Surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readStreakSummary, streakLabel, yesterdayLine, type StreakSummary } from "@/lib/streak/streak";
import styles from "./WorldStreak.module.css";

/** The world streak, the best run, and yesterday's result once it has closed. */
export function StreakPanel({ summary }: { summary: StreakSummary | null }) {
  if (!summary) {
    return (
      <Surface as="section" aria-label="World streak">
        <p className={styles.muted}>The world streak is unavailable right now.</p>
      </Surface>
    );
  }
  return (
    <Surface as="section" aria-label="World streak">
      <p className={styles.streak}>{streakLabel(summary.current)}</p>
      <p className={styles.muted}>Best: {summary.best}</p>
      {summary.yesterday && <p>{yesterdayLine(summary.yesterday)}</p>}
      <Link href="/history" className={styles.link}>
        Every day so far
      </Link>
    </Surface>
  );
}

/** Reads the public streak data on the server. A failed read shows as unavailable, not as an error page. */
export async function WorldStreak() {
  // Outside the try: reading the request cookies is how Next.js learns the page is dynamic, and
  // that signal must not be caught.
  const db = await createSupabaseServerClient();
  let summary: StreakSummary | null = null;
  try {
    summary = await readStreakSummary(db, new Date());
  } catch (error) {
    console.error(error);
  }
  return <StreakPanel summary={summary} />;
}
