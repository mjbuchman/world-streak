// The world streak and the closed days, read from public data by the home and history server
// components. Not for client components: the parsers (zod) would ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { dayLabel } from "@/lib/dates";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { addDays, gameDateAt } from "@/lib/gameDay";
import type { Database } from "@/lib/supabase/database.types";

export const HISTORY_PAGE_SIZE = 30;

/** How many days the streak card's bar chart shows, ending yesterday. */
export const RECENT_DAYS = 14;

type Outcome = "survived" | "broken";
export type DayResult = { outcome: Outcome; finalPassRate: number | null };
/** A closed day as the bar chart needs it. */
export type ClosedDay = DayResult & { gameDate: string; threshold: number };
/**
 * One slot of the bar chart: a survived day of the current run ("streak"), a broken day that ended
 * a run ("broke"), any other closed day ("closed"), or no bar at all ("empty": no result, or
 * nobody played).
 */
export type RecentDay = {
  gameDate: string;
  kind: "streak" | "broke" | "closed" | "empty";
  passRate: number | null;
  threshold: number | null;
  outcome: Outcome | null;
};
export type StreakSummary = { current: number; best: number; yesterday: DayResult | null; recent: RecentDay[] };
export type HistoryDay = DayResult & { gameDate: string; challengeType: string; threshold: number };
export type HistoryPage = { days: HistoryDay[]; page: number; pageCount: number };

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function streakUnit(days: number): string {
  return days === 1 ? "day" : "days";
}

export function passRateLabel(rate: number | null): string {
  return rate === null ? "no attempts" : percent(rate);
}

export function yesterdayLine({ outcome, finalPassRate }: DayResult): string {
  if (outcome === "survived") return `Yesterday the world survived with ${passRateLabel(finalPassRate)} passing`;
  return finalPassRate === null ? "Yesterday the streak broke: nobody played" : `Yesterday the streak broke at ${percent(finalPassRate)}`;
}

/** One day of the bar chart in words, for screen readers. */
export function recentDayLine(day: RecentDay): string {
  const date = dayLabel(day.gameDate);
  if (day.outcome === null) return `${date}: no result`;
  const outcome = day.kind === "broke" ? "broke the streak" : day.outcome;
  if (day.passRate === null) return `${date}: nobody played, ${outcome}`;
  const needed = day.threshold === null ? "" : `, ${percent(day.threshold)} needed`;
  return `${date}: ${percent(day.passRate)} passed${needed}, ${outcome}`;
}

/**
 * The RECENT_DAYS days before `today`, oldest first, from the closed days around them (the day
 * before the window too, to tell whether the first one ended a run). `currentStart` is the first
 * day of the current run, or null when the streak is 0.
 */
export function shapeRecentDays(closed: ClosedDay[], today: string, currentStart: string | null): RecentDay[] {
  const byDate = new Map(closed.map((day) => [day.gameDate, day]));
  return Array.from({ length: RECENT_DAYS }, (_, i) => {
    const gameDate = addDays(today, i - RECENT_DAYS);
    const day = byDate.get(gameDate);
    if (!day) return { gameDate, kind: "empty", passRate: null, threshold: null, outcome: null };
    const shown = { gameDate, passRate: day.finalPassRate, threshold: day.threshold, outcome: day.outcome };
    if (day.finalPassRate === null) return { ...shown, kind: "empty" };
    if (day.outcome === "survived" && currentStart !== null && gameDate >= currentStart) return { ...shown, kind: "streak" };
    const before = byDate.get(addDays(gameDate, -1));
    if (day.outcome === "broken" && before?.outcome === "survived") return { ...shown, kind: "broke" };
    return { ...shown, kind: "closed" };
  });
}

// Kept here for its many importers; the formatter lives in src/lib/dates.ts (T126).
export { dayLabel };

/** The challenge's on-screen name; a type this build does not know yet shows as itself. */
export function challengeName(type: string): string {
  return (CHALLENGE_NAMES as Record<string, string>)[type] ?? type;
}

function dbOutcome(value: unknown): Outcome {
  if (value === "survived" || value === "broken") return value;
  throw new Error(`Expected an outcome, got ${JSON.stringify(value)}`);
}

const dbRate = (value: unknown, field: string) => (value === null ? null : dbNumber(value, field));

/**
 * The streak, yesterday's result once yesterday has closed (null just after midnight), and the
 * last RECENT_DAYS days for the bar chart. All public data, read with the caller's own client.
 */
export async function readStreakSummary(db: Pick<SupabaseClient<Database>, "from" | "rpc">, now: Date): Promise<StreakSummary> {
  const today = gameDateAt(now);
  const yesterdayDate = addDays(today, -1);
  const [streakReply, dayReply, recentReply] = await Promise.all([
    db.rpc("world_streak").single(),
    db.from("game_days").select("outcome, final_pass_rate").eq("game_date", yesterdayDate).not("closed_at", "is", null).maybeSingle(),
    // One day more than the chart shows: it tells whether the first day shown ended a run.
    db
      .from("game_days")
      .select("game_date, outcome, final_pass_rate, survival_threshold")
      .gte("game_date", addDays(today, -(RECENT_DAYS + 1)))
      .lte("game_date", yesterdayDate)
      .not("closed_at", "is", null),
  ]);
  if (streakReply.error) throw new Error(`World streak lookup failed: ${streakReply.error.message}`);
  if (dayReply.error) throw new Error(`Yesterday lookup failed: ${dayReply.error.message}`);
  if (recentReply.error) throw new Error(`Recent days lookup failed: ${recentReply.error.message}`);

  const streak = streakReply.data;
  const day = dayReply.data;
  const current = dbInteger(streak.current, "current");
  if (current < 0) throw new Error(`Expected a streak length for current, got ${current}`);
  // Widened: the generated type cannot promise a running streak's start date is there.
  const currentStart: string | null | undefined = current > 0 ? streak.current_start_date : null;
  if (currentStart === undefined || currentStart === "") throw new Error("A running streak came without its start date");
  const closed = recentReply.data.map((row) => ({
    gameDate: row.game_date,
    outcome: dbOutcome(row.outcome),
    finalPassRate: dbRate(row.final_pass_rate, "final_pass_rate"),
    threshold: dbNumber(row.survival_threshold, "survival_threshold"),
  }));
  return {
    current,
    best: dbInteger(streak.best, "best"),
    yesterday: day && { outcome: dbOutcome(day.outcome), finalPassRate: dbRate(day.final_pass_rate, "final_pass_rate") },
    recent: shapeRecentDays(closed, today, currentStart),
  };
}

/** No history has anywhere near this many pages; a larger `?page` is treated as a bad one. */
export const MAX_HISTORY_PAGE = 10_000;

/** `?page=N` as a page number: anything but a whole number from 1 to MAX_HISTORY_PAGE is page 1. */
export function historyPageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 && page <= MAX_HISTORY_PAGE ? page : 1;
}

/** PostgREST's answer to a range that starts past the last row. */
const RANGE_NOT_SATISFIABLE = "PGRST103";

/** One page (1-based) of closed days, newest first; null when the page starts past the last day. */
export async function readHistory(db: Pick<SupabaseClient<Database>, "from">, page: number): Promise<HistoryPage | null> {
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const { data, error, count } = await db
    .from("game_days")
    .select("game_date, challenge_type, final_pass_rate, survival_threshold, outcome", { count: "exact" })
    .not("closed_at", "is", null)
    .order("game_date", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  if (error?.code === RANGE_NOT_SATISFIABLE) return null;
  if (error) throw new Error(`History lookup failed: ${error.message}`);
  if (count === null) throw new Error("History lookup returned no count");

  return {
    days: data.map((row) => ({
      gameDate: row.game_date,
      challengeType: row.challenge_type,
      finalPassRate: dbRate(row.final_pass_rate, "final_pass_rate"),
      threshold: dbNumber(row.survival_threshold, "survival_threshold"),
      outcome: dbOutcome(row.outcome),
    })),
    page,
    pageCount: Math.max(1, Math.ceil(count / HISTORY_PAGE_SIZE)),
  };
}
