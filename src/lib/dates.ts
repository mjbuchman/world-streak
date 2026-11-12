import { ELIGIBILITY_TIME_ZONE } from "@/config/eligibility";

/** The calendar date (`YYYY-MM-DD`) at instant `now` in an IANA time zone. */
export function calendarDateIn(timeZone: string, now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Game dates are UTC dates, so every label is formatted in UTC (T126: the one copy of each).
const SHORT_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const LONG_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
const INSTANT = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
const utcMidnight = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Nov 1, 2026" for a `YYYY-MM-DD` game date. */
export const dayLabel = (gameDate: string) => SHORT_DAY.format(utcMidnight(gameDate));

/** "January 1, 2027" for a `YYYY-MM-DD` date. */
export const longDayLabel = (date: string) => LONG_DAY.format(utcMidnight(date));

/** "Nov 12, 2026, 3:04 PM" for an ISO instant, in UTC. */
export const instantLabel = (iso: string) => INSTANT.format(new Date(iso));

/** The date used for the sign-up age check. */
export function eligibilityToday(now: Date): string {
  return calendarDateIn(ELIGIBILITY_TIME_ZONE, now);
}
