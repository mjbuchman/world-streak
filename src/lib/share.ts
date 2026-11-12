// The spoiler-free share text (T32). Client-safe: the result screen builds it in the browser.
import { GAME_NAME } from "@/config/game";
import { NEAR_THRESHOLD_MARGIN } from "@/config/share";
import type { MeterBody } from "@/lib/meter";

export type ShareInput = {
  passed: boolean;
  gameDate: string;
  /** The world streak (current run), or null if it could not be read. */
  streak: number | null;
  /** Today's meter reading, or null if it could not be read. */
  meter: MeterBody | null;
  siteUrl: string;
};

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** "Nov 12, 2026": game dates are UTC dates. */
const dateLabel = (gameDate: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${gameDate}T00:00:00Z`));

/** How the world is doing, as a call for help when it is near (or under) the line; null if unknown. */
function worldLine(meter: MeterBody | null): string | null {
  if (!meter) return null;
  if (meter.status === "hidden") return "The meter is hidden. Every attempt counts!";
  if (meter.passRate === null || meter.threshold === null) return null;
  if (meter.passRate < meter.threshold + NEAR_THRESHOLD_MARGIN) {
    return `The world is close to the line at ${percent(meter.passRate)}. We need you: play before the deadline!`;
  }
  return `The world is at ${percent(meter.passRate)} today, ${percent(meter.threshold)} needed.`;
}

/**
 * What a player shares after today's attempt: the outcome, never the score, the target or the
 * challenge, so nobody is spoiled (it is not given them). A pass and a fail differ only in the
 * outcome line (design principle 3).
 */
export function buildShareText({ passed, gameDate, streak, meter, siteUrl }: ShareInput): string {
  const lines = [
    `${GAME_NAME} · ${dateLabel(gameDate)}`,
    passed ? "I passed today's challenge." : "I didn't make it today.",
    streak === null ? null : `World streak: ${streak} ${streak === 1 ? "day" : "days"}.`,
    worldLine(meter),
    siteUrl,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}
