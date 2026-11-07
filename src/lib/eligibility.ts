import { ALLOWED_COUNTRIES, MAX_PLAUSIBLE_AGE, MIN_AGE } from "@/config/eligibility";

export type EligibilityInput = {
  /** Date of birth as `YYYY-MM-DD`. */
  birthDate: string;
  /** Country of residence as an ISO 3166-1 alpha-2 code, any case. */
  country: string;
};

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: "underage" | "region" | "invalid-date" };

export type EligibilityRules = {
  minAge: number;
  allowedCountries: readonly string[];
  /** Birth dates more than this many years before today are invalid. Defaults to MAX_PLAUSIBLE_AGE. */
  maxAge?: number;
};

const DEFAULT_RULES: EligibilityRules = { minAge: MIN_AGE, allowedCountries: ALLOWED_COUNTRIES };

type CalendarDate = { year: number; month: number; day: number };

// Plain calendar dates, compared field by field, so time zones can never shift a birthday.
function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const exists =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  return exists ? { year, month, day } : null;
}

function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

// Whole years completed. A Feb 29 birthday counts as reached on Mar 1 in non-leap years,
// because (2, 28) sorts before (2, 29).
function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const birthdayPassed = today.month > birth.month || (today.month === birth.month && today.day >= birth.day);
  return today.year - birth.year - (birthdayPassed ? 0 : 1);
}

/**
 * Checks the self-declared sign-up details. `today` is the caller's current date as
 * `YYYY-MM-DD` (injected so the rule stays pure and testable).
 */
export function checkEligibility(
  input: EligibilityInput,
  today: string,
  rules: EligibilityRules = DEFAULT_RULES,
): EligibilityResult {
  const todayDate = parseCalendarDate(today);
  if (!todayDate) throw new Error(`Invalid today value "${today}": expected YYYY-MM-DD`);

  const birth = parseCalendarDate(input.birthDate);
  // The oldest allowed birth date may not exist (Feb 29 in a non-leap year); comparing
  // field by field still orders it correctly between Feb 28 and Mar 1.
  const oldestAllowed = { ...todayDate, year: todayDate.year - (rules.maxAge ?? MAX_PLAUSIBLE_AGE) };
  if (!birth || compareDates(birth, todayDate) > 0 || compareDates(birth, oldestAllowed) < 0) {
    return { eligible: false, reason: "invalid-date" };
  }
  if (ageOn(birth, todayDate) < rules.minAge) return { eligible: false, reason: "underage" };

  const country = input.country.trim().toUpperCase();
  if (!rules.allowedCountries.includes(country)) return { eligible: false, reason: "region" };

  return { eligible: true };
}
