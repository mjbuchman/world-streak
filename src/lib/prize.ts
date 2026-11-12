// The prize for a cycle: the flat base plus what rolled in from cycles nobody won; and what the
// home page says about it (T36).
import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_GOAL_DAYS } from "@/config/prize";
import { longDayLabel as longDate } from "@/lib/dates";
import { dbInteger } from "@/lib/db/numeric";
import { gameDateAt } from "@/lib/gameDay";
import { dayLabel } from "@/lib/streak/streak";

/** The prize-relevant part of a `cycles` row. */
export type Cycle = {
  baseCents: number;
  rolloverInCents: number;
  /** When the world streak reached the goal inside the cycle (a game date), or null. */
  goalReachedOn: string | null;
};

export function currentPrizeCents(cycle: Cycle): number {
  return cycle.baseCents + cycle.rolloverInCents;
}

/** What rolls into the next cycle: nothing once this one was won, otherwise its whole prize. */
export function nextRolloverCents(cycle: Cycle): number {
  return cycle.goalReachedOn ? 0 : currentPrizeCents(cycle);
}

/** "$200", or "$200.50" when there are cents. */
export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

export function prizeLine(prizeCents: number, rolloverInCents: number): string {
  const rollover = rolloverInCents > 0 ? `, including ${dollars(rolloverInCents)} rolled over` : "";
  return `Prize this cycle: ${dollars(prizeCents)}${rollover}`;
}

export const cycleDayLine = (day: number, length: number) => `Day ${day} of ${length}`;
export const GOAL_LINE = `Goal: a ${STREAK_GOAL_DAYS}-day world streak`;
export const goalReachedLine = (date: string) => `Goal reached on ${dayLabel(date)}. A winner will be drawn after the cycle ends.`;
export const entriesLine = (count: number) => `Your entries this cycle: ${count}`;


export const preseasonLine = (firstStart: string, prizeCents: number) =>
  `The first cycle starts ${longDate(firstStart)}. Prize: ${dollars(prizeCents)}.`;

export type PrizeSummary =
  | { kind: "preseason"; firstStart: string; prizeCents: number }
  | {
      kind: "cycle";
      number: number;
      /** Today's day of the cycle, from 1. */
      day: number;
      length: number;
      prizeCents: number;
      rolloverInCents: number;
      goalReachedOn: string | null;
      /** The signed-in player's entries in this cycle; null when signed out. */
      entries: number | null;
    };

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

type CycleRow = Record<"number" | "base_prize_cents" | "rollover_in_cents", unknown> & {
  start_date: string;
  end_date: string;
  goal_reached_on: string | null;
};

/**
 * Today's cycle, or preseason before the first one; null between cycles (the next is created when
 * the last day closes) or with none at all. Read with the caller's own client: cycles are public
 * and the entry count is the caller's own.
 */
export async function readPrizeSummary(db: Pick<SupabaseClient, "from" | "rpc">, now: Date, signedIn: boolean): Promise<PrizeSummary | null> {
  const today = gameDateAt(now);
  const current = await db
    .from("cycles_public")
    .select("number, start_date, end_date, base_prize_cents, rollover_in_cents, goal_reached_on")
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();
  if (current.error) throw new Error(`Cycle lookup failed: ${current.error.message}`);

  if (current.data) {
    const row = current.data as CycleRow;
    const number = dbInteger(row.number, "number");
    let entries: number | null = null;
    if (signedIn) {
      const count = await db.rpc("my_entry_count", { cycle: number });
      if (count.error) throw new Error(`Entry count failed: ${count.error.message}`);
      entries = dbInteger(count.data, "my_entry_count");
    }
    const rolloverInCents = dbInteger(row.rollover_in_cents, "rollover_in_cents");
    return {
      kind: "cycle",
      number,
      day: daysBetween(row.start_date, today) + 1,
      length: daysBetween(row.start_date, row.end_date) + 1,
      prizeCents: dbInteger(row.base_prize_cents, "base_prize_cents") + rolloverInCents,
      rolloverInCents,
      goalReachedOn: row.goal_reached_on,
      entries,
    };
  }

  const first = await db.from("cycles_public").select("start_date, base_prize_cents, rollover_in_cents").order("number").limit(1).maybeSingle();
  if (first.error) throw new Error(`First cycle lookup failed: ${first.error.message}`);
  const row = first.data as Omit<CycleRow, "number" | "end_date" | "goal_reached_on"> | null;
  if (!row || today >= row.start_date) return null;
  return {
    kind: "preseason",
    firstStart: row.start_date,
    prizeCents: dbInteger(row.base_prize_cents, "base_prize_cents") + dbInteger(row.rollover_in_cents, "rollover_in_cents"),
  };
}
