import { Surface } from "@/components/ui/Surface";
import {
  cycleDayLine,
  entriesLine,
  GOAL_LINE,
  goalReachedLine,
  preseasonLine,
  prizeLine,
  readPrizeSummary,
  type PrizeSummary,
} from "@/lib/prize";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./PrizeCycle.module.css";

/**
 * The prize and how this cycle is going (T36). Nothing between cycles or after a failed read:
 * the rest of the home page matters more than an "unavailable" note about the prize.
 */
export function PrizePanel({ summary }: { summary: PrizeSummary | null }) {
  if (!summary) return null;
  if (summary.kind === "preseason") {
    return (
      <Surface as="section" aria-label="Prize">
        <p className={styles.prize}>{preseasonLine(summary.firstStart, summary.prizeCents)}</p>
      </Surface>
    );
  }
  return (
    <Surface as="section" aria-label="Prize">
      <p className={styles.prize}>{prizeLine(summary.prizeCents, summary.rolloverInCents)}</p>
      <p className={styles.line}>{cycleDayLine(summary.day, summary.length)}</p>
      <p className={styles.line}>{summary.goalReachedOn ? goalReachedLine(summary.goalReachedOn) : GOAL_LINE}</p>
      {summary.entries !== null && <p className={styles.line}>{entriesLine(summary.entries)}</p>}
    </Surface>
  );
}

/** Reads the prize on the server, with the player's entries when they are signed in. */
export async function PrizeCycle() {
  // Outside the try: reading the request cookies is how Next.js learns the page is dynamic.
  const db = await createSupabaseServerClient();
  let summary: PrizeSummary | null = null;
  try {
    // Verified locally from the session token, as the header does: no extra Auth round trip.
    const { data } = await db.auth.getClaims();
    summary = await readPrizeSummary(db, new Date(), Boolean(data?.claims.sub));
  } catch (error) {
    console.error(error);
  }
  return <PrizePanel summary={summary} />;
}
