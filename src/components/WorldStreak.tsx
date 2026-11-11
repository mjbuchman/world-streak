import Link from "next/link";
import { Surface } from "@/components/ui/Surface";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  RECENT_DAYS,
  readStreakSummary,
  recentDayLine,
  streakUnit,
  yesterdayLine,
  type RecentDay,
  type StreakSummary,
} from "@/lib/streak/streak";
import styles from "./WorldStreak.module.css";

const asPercent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/**
 * One bar: its height is the day's pass rate, a tangerine line marks that day's threshold. A day
 * with no result, or nobody playing, is an empty slot (its details are in the list below).
 */
function Bar({ day }: { day: RecentDay }) {
  return (
    <div className={styles.slot} data-kind={day.kind}>
      {day.passRate !== null && <div className={styles.bar} data-bar="" style={{ height: asPercent(day.passRate) }} />}
      {day.passRate !== null && day.threshold !== null && (
        <div className={styles.line} data-line="" style={{ bottom: asPercent(day.threshold) }} />
      )}
    </div>
  );
}

/**
 * The last RECENT_DAYS days as bars, oldest on the left. The bars are a picture; screen readers get
 * the same days as a list.
 */
function RecentBars({ days }: { days: RecentDay[] }) {
  return (
    <div className={styles.chart}>
      <div className={styles.bars} aria-hidden="true">
        {days.map((day) => (
          <Bar key={day.gameDate} day={day} />
        ))}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>{RECENT_DAYS} days ago</span>
        <span>Yesterday</span>
      </div>
      <ul className="visually-hidden" aria-label={`The last ${RECENT_DAYS} days`}>
        {days.map((day) => (
          <li key={day.gameDate}>{recentDayLine(day)}</li>
        ))}
      </ul>
    </div>
  );
}

/** The world streak, the best run, the last two weeks as bars, and yesterday's result once it has closed. */
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
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>World streak</p>
          <p className={styles.count}>
            <span className={styles.number}>{summary.current}</span> <span className={styles.unit}>{streakUnit(summary.current)}</span>
          </p>
        </div>
        <p className={styles.best}>
          Best <span className={styles.bestNumber}>{summary.best}</span>
        </p>
      </div>
      <RecentBars days={summary.recent} />
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
