// Client-safe and dependency-light: the meter UI imports these types and helpers in the browser,
// so this module imports only config and the game-day arithmetic (a test checks this). The
// database read lives in src/lib/meterRead.ts.
import { METER_CACHE_SECONDS, METER_HIDE_HOURS } from "@/config/meter";
import { deadlineFor, HOUR_MS } from "@/lib/gameDay";

/** When the meter hides for the day closing at `closesAt`: METER_HIDE_HOURS before it. */
export function meterHiddenFrom(closesAt: Date | string): Date {
  return new Date(new Date(closesAt).getTime() - METER_HIDE_HOURS * HOUR_MS);
}

/** What the meter says while hidden, for a window of `hours` (0 only if a stale hidden reply arrives). */
export function meterHiddenMessage(hours: number): string {
  if (hours <= 0) return "The meter is hidden until the deadline, when the result is revealed.";
  const window = hours === 1 ? "hour" : `${hours} hours`;
  return `The meter is hidden for the final ${window}. The result is revealed at the deadline.`;
}

/** The world streak: the current run (0 after a broken day) and the best run ever. */
export type MeterStreak = { current: number; best: number };

/** What the meter needs: one game day's numbers and the world streak. */
export type MeterRow = {
  /** Null only before the day's row exists (no one has started yet, and the close job has not prepared it). */
  threshold: number | null;
  attempts: number;
  weightedAttempts: number;
  weightedPasses: number;
  streak: MeterStreak;
};

export type MeterBody =
  | {
      gameDate: string;
      status: "open";
      passRate: number | null;
      attempts: number;
      threshold: number | null;
      closesAt: string;
      streak: MeterStreak;
    }
  // The streak is not secret in the final hours: it only changes at the close.
  | { gameDate: string; status: "hidden"; threshold: number | null; closesAt: string; streak: MeterStreak };

const isNumberOrNull = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value));
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

function isMeterStreak(value: unknown): value is MeterStreak {
  if (typeof value !== "object" || value === null) return false;
  const streak = value as Record<string, unknown>;
  return isCount(streak.current) && isCount(streak.best) && streak.best >= streak.current;
}

/**
 * Whether a reply has the shape the meter draws, so a malformed one reads as unavailable, not NaN.
 * Hand-written rather than zod, which would ship to the browser. Kept next to meterBody so a test
 * can check every body it produces passes.
 */
export function isMeterBody(value: unknown): value is MeterBody {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  if (typeof body.closesAt !== "string" || Number.isNaN(Date.parse(body.closesAt))) return false;
  if (!isNumberOrNull(body.threshold) || !isMeterStreak(body.streak)) return false;
  if (body.status === "hidden") return true;
  return body.status === "open" && isNumberOrNull(body.passRate) && isCount(body.attempts);
}

/**
 * The meter at `now`. In the final METER_HIDE_HOURS before the deadline the response carries no
 * pass rate or attempt count at all; the counters themselves are server-only, so this answer is
 * the only way to read them.
 */
export function meterBody(now: Date, gameDate: string, row: MeterRow): MeterBody {
  const deadline = deadlineFor(gameDate);
  const closesAt = deadline.toISOString();
  if (now.getTime() >= meterHiddenFrom(deadline).getTime()) {
    return { gameDate, status: "hidden", threshold: row.threshold, closesAt, streak: row.streak };
  }
  // With no weighted attempts yet the rate is unknown, not 0% and not NaN.
  const passRate = row.weightedAttempts > 0 ? row.weightedPasses / row.weightedAttempts : null;
  return { gameDate, status: "open", passRate, attempts: row.attempts, threshold: row.threshold, closesAt, streak: row.streak };
}

/** When `body` stops being true: the hidden window starting (an open reading), or the deadline. */
export function meterOutOfDateAt(body: MeterBody): Date {
  return body.status === "open" ? meterHiddenFrom(body.closesAt) : new Date(body.closesAt);
}

/**
 * How long a CDN may keep `body`: METER_CACHE_SECONDS, but never past the moment the reading
 * goes out of date (the hidden window starting, or the deadline). The cache may also serve a
 * stale copy for as long again while it refreshes, so both periods must fit before that moment.
 */
export function meterCacheSeconds(body: MeterBody, now: Date): number {
  const secondsLeft = Math.floor((meterOutOfDateAt(body).getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(METER_CACHE_SECONDS, Math.floor(secondsLeft / 2)));
}
