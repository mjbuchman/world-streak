import { ELIGIBILITY_TIME_ZONE } from "@/config/eligibility";

/** The calendar date (`YYYY-MM-DD`) at instant `now` in an IANA time zone. */
export function calendarDateIn(timeZone: string, now: Date): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The date used for the sign-up age check. */
export function eligibilityToday(now: Date): string {
  return calendarDateIn(ELIGIBILITY_TIME_ZONE, now);
}
