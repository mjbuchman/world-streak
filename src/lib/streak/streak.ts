// The world streak and the closed days, read from public data by the home and history server
// components. Not for client components: the parsers (zod) would ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { addDays, gameDateAt } from "@/lib/gameDay";

export const HISTORY_PAGE_SIZE = 30;

type Outcome = "survived" | "broken";
export type DayResult = { outcome: Outcome; finalPassRate: number | null };
export type StreakSummary = { current: number; best: number; yesterday: DayResult | null };
export type HistoryDay = DayResult & { gameDate: string; challengeType: string; threshold: number };
export type HistoryPage = { days: HistoryDay[]; page: number; pageCount: number };

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

export function streakLabel(days: number): string {
  return `World streak: ${days} ${days === 1 ? "day" : "days"}`;
}

export function passRateLabel(rate: number | null): string {
  return rate === null ? "no attempts" : percent(rate);
}

export function yesterdayLine({ outcome, finalPassRate }: DayResult): string {
  if (outcome === "survived") return `Yesterday the world survived with ${passRateLabel(finalPassRate)} passing`;
  return finalPassRate === null ? "Yesterday the streak broke: nobody played" : `Yesterday the streak broke at ${percent(finalPassRate)}`;
}

/** "Nov 1, 2026". Game dates are UTC dates, so they are formatted in UTC. */
export function dayLabel(gameDate: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${gameDate}T00:00:00Z`),
  );
}

/** The challenge's on-screen name; a type this build does not know yet shows as itself. */
export function challengeName(type: string): string {
  return (CHALLENGE_NAMES as Record<string, string>)[type] ?? type;
}

function dbOutcome(value: unknown): Outcome {
  if (value === "survived" || value === "broken") return value;
  throw new Error(`Expected an outcome, got ${JSON.stringify(value)}`);
}

const dbRate = (value: unknown, field: string) => (value === null ? null : dbNumber(value, field));

/** The streak, and yesterday's result once yesterday has closed (null just after midnight). */
export async function readStreakSummary(db: Pick<SupabaseClient, "from" | "rpc">, now: Date): Promise<StreakSummary> {
  const [streakReply, dayReply] = await Promise.all([
    db.rpc("world_streak").single(),
    db
      .from("game_days")
      .select("outcome, final_pass_rate")
      .eq("game_date", addDays(gameDateAt(now), -1))
      .not("closed_at", "is", null)
      .maybeSingle(),
  ]);
  if (streakReply.error) throw new Error(`World streak lookup failed: ${streakReply.error.message}`);
  if (dayReply.error) throw new Error(`Yesterday lookup failed: ${dayReply.error.message}`);

  const streak = streakReply.data as { current: unknown; best: unknown };
  const day = dayReply.data as { outcome: unknown; final_pass_rate: unknown } | null;
  const current = dbInteger(streak.current, "current");
  if (current < 0) throw new Error(`Expected a streak length for current, got ${current}`);
  return {
    current,
    best: dbInteger(streak.best, "best"),
    yesterday: day && { outcome: dbOutcome(day.outcome), finalPassRate: dbRate(day.final_pass_rate, "final_pass_rate") },
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

type HistoryRow = { game_date: string; challenge_type: string; final_pass_rate: unknown; survival_threshold: unknown; outcome: unknown };

/** One page (1-based) of closed days, newest first; null when the page starts past the last day. */
export async function readHistory(db: Pick<SupabaseClient, "from">, page: number): Promise<HistoryPage | null> {
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

  const rows = data as HistoryRow[];
  return {
    days: rows.map((row) => ({
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
