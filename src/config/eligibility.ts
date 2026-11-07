// Who may create an account and enter the prize draw (human decision, 2026-11-07).
// Eligibility is self-declared at sign-up; there is no IP-based location check in the MVP.
export const MIN_AGE = 18;

/** ISO 3166-1 alpha-2 codes, upper case. */
export const ALLOWED_COUNTRIES: readonly string[] = ["US"];

// "Today" for the age check is the calendar date in Honolulu. Hawaii is the westernmost US
// state time zone (UTC-10), so its date is the earliest in the US: it never runs ahead of any
// US resident's own date, and the UTC rollover during a US evening can't admit anyone early.
export const ELIGIBILITY_TIME_ZONE = "Pacific/Honolulu";

// Birth dates more than this many years ago are treated as typos, not players.
export const MAX_PLAUSIBLE_AGE = 120;
