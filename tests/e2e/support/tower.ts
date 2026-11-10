import type { Page } from "@playwright/test";
import { COLUMNS, simulate, stepMs, type StackingParams } from "../../../src/challenges/stacking/engine";

/** The deepest search for a miss; narrowing the tower to one cell at an edge takes about three rows. */
const MAX_ROWS = 5;

/**
 * Tap times (whole ms from the start of the run) that end the run with a deliberate miss: a tap
 * that locks a row clear of the tower. Found with the real engine for these params by trying
 * each step of the moving row, shortest sequence first. A perfectly centred tower cannot always
 * be missed (a 3-wide row overlaps it everywhere), so the search narrows the tower first.
 */
export function tapsForAMiss(params: StackingParams): number[] {
  let sequences: number[][] = [[]];
  for (let depth = 0; depth < MAX_ROWS; depth++) {
    const next: number[][] = [];
    for (const taps of sequences) {
      const moving = simulate(params, taps, (taps.at(-1) ?? 0) + 1).moving;
      if (!moving) continue;
      const step = stepMs(params, moving.row);
      // Each position of a full bounce, tapped in the middle of its step.
      for (let i = 0; i < 2 * COLUMNS; i++) {
        const tap = Math.round(moving.startMs + step * (i + 0.5));
        const result = simulate(params, [...taps, tap]);
        const locked = result.rows[moving.row - 1];
        if (locked.byTap && locked.width === 0) return [...taps, tap];
        if (locked.byTap && locked.width > 0) next.push([...taps, tap]);
      }
    }
    sequences = next;
  }
  throw new Error("No deliberate miss found");
}

/**
 * Presses Space at each tap time, measured from the moment the run started. The page's clock
 * must be paused (page.clock.pauseAt) before the run starts, so the game's start time and every
 * tap land on exact milliseconds.
 */
export async function playTaps(page: Page, taps: number[]): Promise<void> {
  let now = 0;
  for (const tap of taps) {
    await page.clock.runFor(tap - now);
    await page.keyboard.press("Space");
    now = tap;
  }
}
