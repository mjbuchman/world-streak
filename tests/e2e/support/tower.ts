import type { Page } from "@playwright/test";

// The deliberate-miss search lives with the engine's other test support.
export { tapsForAMiss } from "../../../src/challenges/stacking/player";

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

/**
 * Makes the page's random seeds (practice runs) come out as `seed`, so a test knows the run's
 * params. Only for pages that use no other random values (the signed-out practice page).
 */
export async function pinSeed(page: Page, seed: number): Promise<void> {
  await page.addInitScript((value) => {
    crypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) array.fill(value);
      return array;
    }) as Crypto["getRandomValues"];
  }, seed);
}
