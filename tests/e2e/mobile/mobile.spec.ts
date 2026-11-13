import type { Locator, Page } from "@playwright/test";
import { paramsFromSeed } from "../../../src/challenges/stacking/engine";
import { FALL_MS } from "../../../src/challenges/stacking/render";
import { expect, test } from "../support/fixtures";
import { gotoReady, signUpViaForm } from "../support/pages";
import { pinSeed, skipCountdown, tapsForAMiss } from "../support/tower";

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

for (const path of ["/", "/practice", "/practice/stacking", "/practice/inner-clock", "/practice/flash-count", "/rules"]) {
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
  // A tap during the 3-2-1 does not count (T138).
  await expect(page.locator("[data-clock]")).not.toHaveAttribute("data-clock", "countdown");
  await tap(page, area);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/^\d+(\.\d+)? s early$/);
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
  await page.keyboard.type("20");
  await tap(page, page.getByRole("button", { name: "Submit" }));
  await expect(page.getByText(/^You said 20\. There were \d+ dots\.$/)).toBeVisible();
  await expectPhoneFriendly(page);
});
