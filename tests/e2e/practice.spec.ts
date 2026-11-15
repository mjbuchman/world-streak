import type { Page } from "@playwright/test";
import { paramsFromSeed, simulate } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { reachedRow } from "../../src/components/stacking/rows";
import { expect, test } from "./support/fixtures";
import { gotoReady } from "./support/pages";
import { pinSeed, playTaps, skipCountdown, tapsForAMiss } from "./support/tower";

test("practice tower works signed out, ends with a score and offers another go", async ({ page }) => {
  const attemptRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/attempts")) attemptRequests.push(request.url());
  });
  // A paused clock drives performance.now() and requestAnimationFrame, and a pinned seed fixes
  // the run, so the test can end it with a deliberate miss (a row never ends by itself).
  const seed = 777;
  await pinSeed(page, seed);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/practice/stacking");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
  // The 3-2-1 over the board comes first (T138).
  await expect(page.locator("[data-countdown]")).toHaveText("3");
  await skipCountdown(page);
  await expect(page.locator("[data-countdown]")).toHaveCount(0);
  const taps = tapsForAMiss(paramsFromSeed(seed));
  await playTaps(page, taps.slice(0, -1));
  // The missing tap's Space is still held down when the run ends.
  await page.clock.runFor(taps.at(-1)! - (taps.at(-2) ?? 0));
  await page.keyboard.down("Space");
  await page.clock.runFor(FALL_MS + 50);

  const result = page.getByRole("heading", { name: /^You reached row \d+$/ });
  await expect(result).toBeVisible();
  await expect(result).toBeFocused();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();

  // Releasing it, or pressing Space again, does not start another run.
  await page.keyboard.up("Space");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(result).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
  await expect(page.getByRole("img", { name: /game area/ })).toBeFocused();
  expect(attemptRequests).toEqual([]);
});

test("a deliberate miss in practice ends the run with the score the engine gives, and a best row", async ({ page }) => {
  // Pin the browser's random seed, so the test knows the run's params and can aim its taps.
  const seed = 12345;
  await pinSeed(page, seed);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/practice/stacking");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
  // The header hides during practice runs too (DECISIONS, T81).
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeHidden();

  const params = paramsFromSeed(seed);
  const taps = tapsForAMiss(params);
  const { score, endReason } = simulate(params, taps);
  expect(endReason).toBe("miss");
  await skipCountdown(page);
  await playTaps(page, taps);
  await page.clock.runFor(FALL_MS + 50);

  await expect(page.getByRole("heading", { name: reachedRow(score) })).toBeVisible();
  const bigScore = page.locator("[data-big-score]");
  await expect(bigScore).toHaveText(String(score));
  // Scoreboard style: the display face.
  expect(await bigScore.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Unbounded/i);
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();

  // The next run shows this visit's best.
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByText(`Best: row ${score}`)).toBeVisible();
});

/** Every request to the scored-attempt endpoints; practice must make none (T49). */
function attemptRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/attempts")) seen.push(request.url());
  });
  return seen;
}

test("Second Sense practice: rounds drain the time bank until a miss empties it", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/inner-clock");
  await expect(page.getByText(/^First target: \d+(\.\d)? seconds$/)).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const tapArea = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expect(tapArea).toBeFocused();
  // A 3-2-1 first (T138), then a clock runs for a moment as a starting point, then hides.
  const shownClock = page.locator("[data-clock]");
  await expect(shownClock).toHaveAttribute("data-clock", "countdown");
  await expect(page.locator("[data-countdown]")).toBeVisible();
  await expect(shownClock).toHaveAttribute("data-clock", "shown");
  await expect(shownClock).toHaveText(/^0\.\d$/);
  await expect(shownClock).toHaveAttribute("data-clock", "hidden");
  await expect(shownClock).toHaveText("");
  await expect(page.getByRole("timer")).toHaveCount(0);
  const bank = page.getByRole("meter", { name: "Error budget left" });
  await expect(bank).toHaveAttribute("aria-valuenow", "3000");
  await tapArea.click();

  // Round 1's target is 3 to 3.5 s, so a tap after about 1.5 s is early, and the bank drains by it.
  await expect(page.getByRole("status")).toHaveText(/^(\d+(\.\d+)? s (early|late)|Spot on)$/);
  await expect(bank).not.toHaveAttribute("aria-valuenow", "3000");
  // Round 2 (a 4 s target or more) starts without a 3-2-1; a tap at once misses by more than is left.
  await expect(page.getByText("Round 2 of 8")).toBeVisible();
  await expect(shownClock).toHaveAttribute("data-clock", "shown");
  await page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ }).click();

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("1 round survived");
  await expect(page.getByText(/^0 s of your 3 s time bank left\. Score: 1\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  expect(scored).toEqual([]);
});

test("Swift Sum practice: three wrong counts on level 1 use up the lives and end the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/flash-count");
  await page.getByRole("button", { name: "Start" }).click();
  const lives = page.getByRole("img", { name: /lives left$/ });
  await expect(lives).toHaveAccessibleName("3 of 3 lives left");

  // 999 is wrong on every level; each miss replays level 1 with new dots, without a 3-2-1.
  for (const left of [2, 1, 0]) {
    await expect(page.locator("canvas")).toHaveAttribute("data-showing", "dots");
    // The flash lasts the level's flashMs; the check keeps looking until the board clears.
    await expect(page.locator("canvas")).toHaveAttribute("data-showing", "clear");
    const answer = page.getByRole("textbox", { name: "How many dots were there?" });
    await expect(answer).toHaveAttribute("inputmode", "numeric");
    await answer.fill("999");
    await page.getByRole("button", { name: "Submit" }).click();
    if (left > 0) {
      await expect(lives).toHaveAccessibleName(`${left} of 3 lives left`);
      await expect(page.getByText("Level 1 of 10")).toBeVisible();
    }
  }

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 levels cleared");
  await expect(page.getByText("0 of 3 lives left. Score: 0.")).toBeVisible();
  expect(scored).toEqual([]);
});

test("Echo Path practice: watch, then wrong tiles use up the lives and end the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/echo-path");
  await page.getByRole("button", { name: "Start" }).click();
  const board = page.getByRole("img", { name: /Get ready|Watch the tiles|Tap the tiles/ });
  const lives = page.getByRole("img", { name: /lives left$/ });
  await expect(lives).toHaveAccessibleName("3 of 3 lives left");
  // Key 1 is tile 1. Pressed twice in a row it is always wrong by the second time (a path never
  // repeats a tile), so each life goes within two presses, and the path is never repeated.
  for (const left of [2, 1, 0]) {
    await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
    await board.press("1");
    // A right first tile leaves the lives as they were; the second press of tile 1 is then wrong.
    // (After the last life the game, and its lives, give way to the result.)
    const still = await lives.getAttribute("aria-label", { timeout: 1_000 }).catch(() => null);
    if (still === `${left + 1} of 3 lives left`) await board.press("1");
    if (left > 0) await expect(lives).toHaveAccessibleName(`${left} of 3 lives left`);
  }
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No path repeated");
  await expect(page.getByText("0 of 3 lives left. Score: 0.")).toBeVisible();
  expect(scored).toEqual([]);
});

test("the practice hub opens each challenge's practice page", async ({ page }) => {
  for (const [name, path, heading] of [
    ["Teetering Tower", "/practice/stacking", "Practice: Teetering Tower"],
    ["Second Sense", "/practice/inner-clock", "Practice: Second Sense"],
    ["Swift Sum", "/practice/flash-count", "Practice: Swift Sum"],
    ["Echo Path", "/practice/echo-path", "Practice: Echo Path"],
  ]) {
    await gotoReady(page, "/practice");
    await page.getByRole("list", { name: "Challenges" }).getByRole("link", { name }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    // Practice pages never show an ad (T44).
    await expect(page.locator("[data-ad-slot]")).toHaveCount(0);
  }
});

test("the home page links to practice", async ({ page }) => {
  await gotoReady(page, "/");
  await page.getByRole("link", { name: "Practice first" }).click();
  await expect(page).toHaveURL("/practice/stacking");
});
