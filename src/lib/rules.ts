// The draft official rules (T38). Every number comes from src/config, so the rules cannot drift
// from what the game does. The prize is flat with rollover (human's decision): no formula,
// floor, cap or revenue share.
import { ALLOWED_COUNTRIES, MIN_AGE } from "@/config/eligibility";
import { COUNTRY_OPTIONS } from "@/config/countries";
import { CYCLE_LENGTH_DAYS, FIRST_CYCLE_START, PAYOUT_WITHIN_DAYS, PRIZE_PER_CYCLE_CENTS, STREAK_GOAL_DAYS } from "@/config/prize";
import { DEADLINE_UTC_HOUR } from "@/config/schedule";
import { SPONSOR, type Sponsor } from "@/config/sponsor";
import { dollars } from "@/lib/prize";

export type RulesConfig = {
  minAge: number;
  /** Country names, in order. */
  countries: string[];
  prizeCents: number;
  cycleLengthDays: number;
  streakGoalDays: number;
  firstCycleStart: string;
  payoutWithinDays: number;
  deadlineUtcHour: number;
  sponsor: Sponsor;
};

/** A country as a sentence names it: "the United States", "Canada". */
function countryName(code: string): string {
  const name = COUNTRY_OPTIONS.find((option) => option.code === code)?.name ?? code;
  return name.startsWith("United ") ? `the ${name}` : name;
}

export const RULES_CONFIG: RulesConfig = {
  minAge: MIN_AGE,
  countries: ALLOWED_COUNTRIES.map(countryName),
  prizeCents: PRIZE_PER_CYCLE_CENTS,
  cycleLengthDays: CYCLE_LENGTH_DAYS,
  streakGoalDays: STREAK_GOAL_DAYS,
  firstCycleStart: FIRST_CYCLE_START,
  payoutWithinDays: PAYOUT_WITHIN_DAYS,
  deadlineUtcHour: DEADLINE_UTC_HOUR,
  sponsor: SPONSOR,
};

/** "midnight UTC", "noon UTC" or "05:00 UTC". */
export function deadlineLabel(hour: number): string {
  if (hour === 0) return "midnight UTC";
  if (hour === 12) return "noon UTC";
  return `${String(hour).padStart(2, "0")}:00 UTC`;
}

const longDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00Z`));

const isPlaceholder = (value: string) => /^\[.*\]$/.test(value.trim());

/** True while any sponsor detail is still a "[...]" placeholder. */
export function isDraft(sponsor: Sponsor): boolean {
  return Object.values(sponsor).some(isPlaceholder);
}

export type RulesSection = { heading: string; paragraphs: string[] };

export function rulesSections(c: RulesConfig): RulesSection[] {
  const prize = dollars(c.prizeCents);
  return [
    {
      heading: "Free to enter",
      paragraphs: ["No purchase or payment of any kind is necessary to enter or to win. Paying would not improve your chances."],
    },
    {
      heading: "Who can enter",
      paragraphs: [
        `The game is open to legal residents of ${c.countries.join(" or ")} who are at least ${c.minAge} years old. Age and residence are checked when you create an account.`,
        "One account per person. Entries from any extra account are void.",
      ],
    },
    {
      heading: "How a game day works",
      paragraphs: [
        "Each game day has one short skill challenge, and every account gets one scored attempt per game day. Your attempt passes if your score reaches the day's pass target, shown before you play.",
        `Each game day ends at ${deadlineLabel(c.deadlineUtcHour)}.`,
      ],
    },
    {
      heading: "The world streak",
      paragraphs: [
        "If enough of the day's players pass (the day's survival threshold, shown on the meter), the world streak grows by one day. If not, it resets to zero for everyone.",
      ],
    },
    {
      heading: "Cycles and the goal",
      paragraphs: [
        `Play runs in cycles of ${c.cycleLengthDays} days. The first cycle starts ${longDate(c.firstCycleStart)}, and each cycle starts the day after the one before it ends.`,
        `The goal is a ${c.streakGoalDays}-day world streak at any point within a cycle. The streak starts from zero at the start of each cycle.`,
      ],
    },
    {
      heading: "The prize",
      paragraphs: [
        `The prize is ${prize} per cycle. If a cycle ends without reaching the goal, the whole prize rolls over to the next cycle and is added to its prize. The current prize is always shown on the home page.`,
      ],
    },
    {
      heading: "Entries and the draw",
      paragraphs: [
        "Each game day within a cycle on which your attempt passes earns one entry.",
        "When a cycle in which the goal was reached ends, one winner is drawn at random from all of that cycle's entries, so more entries mean better odds.",
        "Accounts flagged for cheating, such as scripted play or more than one account per person, lose their entries.",
      ],
    },
    {
      heading: "Winner and payment",
      paragraphs: [
        `The winner must verify their email address before payout. The prize is paid within ${c.payoutWithinDays} days of the cycle ending.`,
      ],
    },
    {
      heading: "Sponsor",
      paragraphs: [`${c.sponsor.name}, ${c.sponsor.address}. Questions: ${c.sponsor.email}.`],
    },
  ];
}
