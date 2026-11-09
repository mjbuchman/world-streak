import { DEADLINE_UTC_HOUR } from "@/config/schedule";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The game date (`YYYY-MM-DD`) being played at `now`: the date that closes at the next deadline.
 * Game date D runs from D at the deadline hour (UTC) up to, not including, D + 1 at that hour.
 */
export function gameDateAt(now: Date, deadlineUtcHour: number = DEADLINE_UTC_HOUR): string {
  return new Date(now.getTime() - deadlineUtcHour * HOUR_MS).toISOString().slice(0, 10);
}

/** The instant game date `gameDate` closes: the next calendar day at the deadline hour, UTC. */
export function deadlineFor(gameDate: string, deadlineUtcHour: number = DEADLINE_UTC_HOUR): Date {
  const start = new Date(`${gameDate}T00:00:00.000Z`);
  // Date accepts some impossible dates (it rolls 2026-11-31 over), so check the round trip.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate) || Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== gameDate) {
    throw new Error(`Not a valid game date: "${gameDate}"`);
  }
  return new Date(start.getTime() + DAY_MS + deadlineUtcHour * HOUR_MS);
}
