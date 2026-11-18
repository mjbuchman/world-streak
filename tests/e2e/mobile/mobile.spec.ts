import type { Locator, Page } from "@playwright/test";
import { COLS, ROWS } from "../../../src/challenges/echo-path/engine";
import { boardLayout } from "../../../src/challenges/echo-path/render";
import { paramsFromSeed, type StackingParams } from "../../../src/challenges/stacking/engine";
import { FALL_MS } from "../../../src/challenges/stacking/render";
import { expect, test } from "../support/fixtures";
import { gotoReady, signUpViaForm } from "../support/pages";
import { pinSeed, playTaps, skipCountdown, tapsForAMiss } from "../support/tower";

// Runs on the phone projects only (playwright.config.ts): Pixel 7 and a 390 x 844 touch screen.

/** The page scrolls only vertically, and every button and link is at least 44 x 44 CSS px. */
async function expectPhoneFriendly(page: Page) {
  const layout = await page.evaluate(() => ({
    // The body too, in case it hides an overflow the page itself does not show.
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    clientWidth: document.documentElement.clientWidth,
    // Rendered controls only (fixed ones included); hidden ones have no boxes.
    small: [...document.querySelectorAll<HTMLElement>("a[href], button")]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({ name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim(), box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ name, box }) => `${name} (${Math.round(box.width)} x ${Math.round(box.height)})`),
  }));
  expect(layout.scrollWidth, "no horizontal scroll").toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.small, "buttons and links under 44 x 44 px").toEqual([]);
}

/**
 * The board fits the screen and quick taps on it never zoom: `manipulation` turns off double-tap
 * zoom, and the Tower's `none` (it is tapped fastest) also turns off pinch-zoom on the board.
 */
async function expectBoardFits(page: Page, board: Locator) {
  const box = (await board.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(["manipulation", "none"]).toContain(await board.evaluate((element) => getComputedStyle(element).touchAction));
}

async function tap(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/** A one-finger drag through Chromium's touch input, as a phone sends it. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  for (let step = 1; step <= 8; step++) {
    const point = { x: from.x + ((to.x - from.x) * step) / 8, y: from.y + ((to.y - from.y) * step) / 8 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

for (const path of [
  "/",
  "/practice",
  "/practice/stacking",
  "/practice/inner-clock",
  "/practice/flash-count",
  "/practice/echo-path",
  "/practice/fair-split",
  "/rules",
]) {
  test(`${path} fits the phone and every control is big enough to tap`, async ({ page }) => {
    await gotoReady(page, path);
    await expectPhoneFriendly(page);
  });
}

test("/play fits the phone for a signed-in player", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  await gotoReady(page, "/play");
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expectPhoneFriendly(page);
});

test("the Tower can be played to the end with taps, on a board that fits", async ({ page }) => {
  const seed = 777;
  await pinSeed(page, seed);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/practice/stacking");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await tap(page, page.getByRole("button", { name: "Start" }));
  const board = page.getByRole("img", { name: /game area/ });
  await expect(page.getByRole("status")).toHaveText("Row 1");
  await expectBoardFits(page, board);

  await skipCountdown(page);
  let now = 0;
  for (const at of tapsForAMiss(paramsFromSeed(seed))) {
    await page.clock.runFor(at - now);
    await tap(page, board);
    now = at;
  }
  await page.clock.runFor(FALL_MS + 50);
  await expect(page.getByRole("heading", { name: /^You reached row \d+$/ })).toBeVisible();
  await expectPhoneFriendly(page);
});

test("Second Sense can be played with a tap, on an area that fits", async ({ page }) => {
  await gotoReady(page, "/practice/inner-clock");
  await tap(page, page.getByRole("button", { name: "Start" }));
  const area = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expectBoardFits(page, area);
  await expect(page.locator("[data-clock]")).toHaveAttribute("data-clock", "shown");
  await tap(page, area);
  // A tap at once misses round 1's 15 s or longer target by more than the 10 s bank.
  await expect(page.getByRole("heading", { level: 2, name: "0 rounds survived" })).toBeVisible();
  await expectPhoneFriendly(page);
});

test("Swift Sum can be answered with taps, on a board that fits", async ({ page }) => {
  await gotoReady(page, "/practice/flash-count");
  await tap(page, page.getByRole("button", { name: "Start" }));
  const board = page.locator("canvas");
  await expectBoardFits(page, board);
  await expect(board).toHaveAttribute("data-showing", "clear", { timeout: 10_000 });
  const answer = page.getByRole("textbox", { name: "How many dots were there?" });
  await tap(page, answer);
  // 999 is wrong on any level: a life goes, and the level replays.
  await page.keyboard.type("999");
  await tap(page, page.getByRole("button", { name: "Submit" }));
  await expect(page.getByRole("img", { name: "2 of 3 lives left" })).toBeVisible();
  await expectPhoneFriendly(page);
});

/** The board never zooms the page, by double tap or by pinch (T166). */
async function expectNoZoom(board: Locator) {
  expect(await board.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
}

test("Echo Path can be played to the end with taps, on tiles big enough to tap", async ({ page }) => {
  await gotoReady(page, "/practice/echo-path");
  await tap(page, page.getByRole("button", { name: "Start" }));
  const board = page.locator("canvas[data-phase]");
  await expectBoardFits(page, board);
  await expectNoZoom(board);
  const box = (await board.boundingBox())!;
  const layout = boardLayout(box.width, box.height, COLS, ROWS);
  expect(layout.tileSize).toBeGreaterThanOrEqual(44);
  const firstTile = { x: box.x + layout.left + layout.gap + layout.tileSize / 2, y: box.y + layout.top + layout.gap + layout.tileSize / 2 };

  // The first tile tapped twice in a row is wrong by the second tap at the latest (a path never
  // repeats a tile), so each life goes within two taps.
  const lives = page.getByRole("img", { name: /lives left$/ });
  for (const left of [2, 1, 0]) {
    await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
    await page.touchscreen.tap(firstTile.x, firstTile.y);
    const still = await lives.getAttribute("aria-label", { timeout: 1_000 }).catch(() => null);
    if (still === `${left + 1} of 3 lives left`) await page.touchscreen.tap(firstTile.x, firstTile.y);
    if (left > 0) await expect(lives).toHaveAccessibleName(`${left} of 3 lives left`);
  }
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No path repeated");
  await expectPhoneFriendly(page);
});

test("Fair Split takes a cut from a touch drag, on a board that fits", async ({ page }) => {
  await gotoReady(page, "/practice/fair-split");
  await tap(page, page.getByRole("button", { name: "Start" }));
  const board = page.locator("canvas[data-phase]");
  await expectBoardFits(page, board);
  await expectNoZoom(board);
  await expect(board).toHaveAttribute("data-phase", "cut", { timeout: 10_000 });
  const box = (await board.boundingBox())!;
  const middle = box.x + box.width / 2;
  await touchDrag(page, { x: middle, y: box.y + 4 }, { x: middle, y: box.y + box.height - 4 });
  await expect(page.getByText(/^\d+\.\d% and \d+\.\d%\./)).toBeVisible();
  await expectPhoneFriendly(page);
});

test("the /play screens between games, after the day is decided, and the results fit the phone", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/play");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  const started = page.waitForResponse("**/api/attempts/start");
  await tap(page, page.getByRole("button", { name: "Start" }));
  const instance = (await (await started).json()) as { params: StackingParams };
  await skipCountdown(page);
  await playTaps(page, tapsForAMiss(instance.params));
  await page.clock.runFor(FALL_MS + 50);
  await expect(page.getByRole("heading", { name: "Game 1 of 3: lost" })).toBeVisible();
  await expectPhoneFriendly(page);
  await page.clock.resume();

  // Game 2 started and left is the second loss, which decides the day.
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);
  await gotoReady(page, "/play");
  await expect(page.getByRole("button", { name: "Play it anyway" })).toBeVisible();
  await expectPhoneFriendly(page);
  await gotoReady(page, "/play/results");
  await expect(page.getByRole("heading", { name: "Not today: two losses" })).toBeVisible();
  await expectPhoneFriendly(page);
});
