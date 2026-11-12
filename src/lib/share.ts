// The spoiler-free share text (T32). Client-safe: the result screen builds it in the browser.
import { GAME_NAME } from "@/config/game";
import { NEAR_THRESHOLD_MARGIN } from "@/config/share";
import { dayLabel as dateLabel } from "@/lib/dates";
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

const BAR_SQUARES = 10;

/**
 * The meter as 10 emoji squares: filled to the pass rate, green at or above the line and orange
 * below it (by the real comparison, so a rate just under the line is orange however it rounds).
 */
export function meterBar(passRate: number, threshold: number): string {
  const filled = Math.round(passRate * BAR_SQUARES);
  const fill = passRate >= threshold ? "🟩" : "🟧";
  return fill.repeat(filled) + "⬜".repeat(BAR_SQUARES - filled);
}


/** How the world is doing, plus a call for help when it is near (or under) the line; none if unknown. */
function worldLines(meter: MeterBody | null): string[] {
  if (!meter) return [];
  if (meter.status === "hidden") return ["🙈 The meter is hidden. Every attempt counts!"];
  const { passRate, threshold } = meter;
  if (passRate === null || threshold === null) return [];
  const status = `${meterBar(passRate, threshold)} ${percent(passRate)} today, ${percent(threshold)} needed`;
  if (passRate < threshold + NEAR_THRESHOLD_MARGIN) {
    return [status, "🆘 The world is close to the line. We need you: play before the deadline!"];
  }
  return [status];
}

/**
 * What a player shares after today's attempt: the outcome, never the score, the target or the
 * challenge, so nobody is spoiled (it is not given them). A pass and a fail differ only in the
 * outcome line (design principle 3).
 */
export function buildShareText({ passed, gameDate, streak, meter, siteUrl }: ShareInput): string {
  const lines = [
    `${GAME_NAME} · ${dateLabel(gameDate)}`,
    passed ? "✅ I passed today's challenge." : "❌ I didn't make it today.",
    streak === null ? null : `🔥 World streak: ${streak} ${streak === 1 ? "day" : "days"}`,
    ...worldLines(meter),
    siteUrl,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}
