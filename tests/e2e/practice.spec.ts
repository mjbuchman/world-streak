import type { Locator, Page } from "@playwright/test";
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

/** Fails when the two elements' boxes overlap at all. */
async function expectApart(a: Locator, b: Locator) {
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  expect(boxA && boxB).toBeTruthy();
  const overlaps =
    boxA!.x < boxB!.x + boxB!.width && boxB!.x < boxA!.x + boxA!.width && boxA!.y < boxB!.y + boxB!.height && boxB!.y < boxA!.y + boxA!.height;
  expect(overlaps).toBe(false);
}

test("Second Sense practice: a 3-2-1 under the target, a 2 s clock, and a miss bigger than the bank ends the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/inner-clock");
  await expect(page.getByText(/^First target: \d+(\.\d)? seconds$/)).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  // The 3-2-1 under round 1's target (T182), with the four steps and the full bank above.
  await expect(page.getByRole("img", { name: "Round 1 of 4" })).toBeVisible();
  const bank = page.getByRole("meter", { name: "Time bank" });
  await expect(bank).toHaveAttribute("aria-valuenow", "10000");
  await expect(page.locator("[data-countdown]")).toBeVisible();
  await expect(page.getByText(/^Tap when you think [\d.]+ seconds have passed$/)).toBeVisible();

  // Then the round: a clock for 2 s as a starting point, then hidden.
  const tapArea = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expect(tapArea).toBeFocused();
  const shownClock = page.locator("[data-clock]");
  await expect(shownClock).toHaveAttribute("data-clock", "shown");
  await expect(shownClock).toHaveText(/^[01]\.\d$/);
  await expect(shownClock).toHaveAttribute("data-clock", "hidden");
  await expect(page.getByRole("timer")).toHaveCount(0);
  // Round 1's target is at least 15 s, so a tap now misses by more than the 10 s bank.
  await tapArea.click();

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 rounds survived");
  await expect(page.getByText(/^0 s of your 10 s time bank left\. Score: 0\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  expect(scored).toEqual([]);
});

for (const size of [
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
]) {
  test(`Second Sense keeps the target clear of the 3-2-1 and the clock at ${size.width} x ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await gotoReady(page, "/practice/inner-clock");
    await page.getByRole("button", { name: "Start" }).click();
    const target = page.getByText(/^Tap when you think [\d.]+ seconds have passed$/);
    const number = page.locator("[data-countdown]");
    await expect(number).toBeVisible();
    await expectApart(target, number);
    const shownClock = page.locator('[data-clock="shown"]');
    await expect(shownClock).toBeVisible();
    await expectApart(target, shownClock);
  });
}

test("Swift Sum practice: a count far off in round 1 busts the dot bank and ends the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/flash-count");
  await page.getByRole("button", { name: "Start" }).click();
  const bank = page.getByRole("meter", { name: "Dot bank" });
  await expect(bank).toHaveAttribute("aria-valuetext", "10 dots left of 10 dots");
  await expect(page.getByText("Round 1", { exact: true })).toBeVisible();

  // After the 3-2-1, the flash lasts the round's flashMs; the check keeps looking until the board clears.
  await expect(page.locator("canvas")).toHaveAttribute("data-showing", "dots", { timeout: 10_000 });
  await expect(page.locator("canvas")).toHaveAttribute("data-showing", "clear");
  const answer = page.getByRole("textbox", { name: "How many dots were there?" });
  await expect(answer).toHaveAttribute("inputmode", "numeric");
  // Round 1 has at most 11 dots, so 999 misses by far more than the 10-dot bank.
  await answer.fill("999");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(bank).toHaveAttribute("aria-valuetext", "Bank used up");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 rounds survived");
  await expect(page.getByText("0 dots of your 10-dot bank left. Score: 0.")).toBeVisible();
  expect(scored).toEqual([]);
});

test("Echo Path practice: watch, then wrong tiles use up the lives and end the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/echo-path");
  await page.getByRole("button", { name: "Start" }).click();
  const board = page.getByRole("img", { name: /Get ready|Watch the tiles|Tap the tiles/ });
  const lives = page.getByRole("img", { name: /lives left$/ });
  await expect(lives).toHaveAccessibleName("3 of 3 lives left");
  // The first arrow shows the ring on the bottom row; nine more take it to the top row, where a
  // path never starts. Each Enter there is a wrong first tile and costs a life (T190).
  for (let i = 0; i < 10; i++) await board.press("ArrowUp");
  for (const left of [2, 1, 0]) {
    await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
    await board.press("Enter");
    // (After the last life the game, and its lives, give way to the result.)
    if (left > 0) await expect(lives).toHaveAccessibleName(`${left} of 3 lives left`);
  }
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No path repeated");
  await expect(page.getByText("0 of 3 lives left. Score: 0.")).toBeVisible();
  expect(scored).toEqual([]);
});

test("Fair Split practice: dragging the line never cuts; Cut shows both sides' percentages", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/fair-split");
  await page.getByRole("button", { name: "Start" }).click();
  const board = page.locator("canvas[data-phase]");
  await expect(board).toHaveAttribute("data-phase", "cut", { timeout: 10_000 });
  const box = (await board.boundingBox())!;
  // The line starts down the middle: drag it by its middle a little to the right and let go.
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 20, middle.y, { steps: 8 });
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-phase", "cut");
  await page.getByRole("button", { name: "Cut" }).click();
  await expect(page.getByText(/^\d+\.\d% and \d+\.\d%\./)).toBeVisible();
  expect(scored).toEqual([]);
});

test("the practice hub opens each challenge's practice page", async ({ page }) => {
  for (const [name, path, heading] of [
    ["Teetering Tower", "/practice/stacking", "Practice: Teetering Tower"],
    ["Second Sense", "/practice/inner-clock", "Practice: Second Sense"],
    ["Swift Sum", "/practice/flash-count", "Practice: Swift Sum"],
    ["Echo Path", "/practice/echo-path", "Practice: Echo Path"],
    ["Fair Split", "/practice/fair-split", "Practice: Fair Split"],
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
