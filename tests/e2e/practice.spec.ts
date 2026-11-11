import { paramsFromSeed, simulate } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { reachedRow } from "../../src/components/stacking/rows";
import { expect, test } from "./support/fixtures";
import { gotoReady } from "./support/pages";
import { pinSeed, playTaps, tapsForAMiss } from "./support/tower";

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
  await page.goto("/practice/stacking");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
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
  await page.goto("/practice/stacking");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
  // The header hides during practice runs too (DECISIONS, T81).
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeHidden();

  const params = paramsFromSeed(seed);
  const taps = tapsForAMiss(params);
  const { score, endReason } = simulate(params, taps);
  expect(endReason).toBe("miss");
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

test("Second Sense practice: start, tap after about a second, and see how far off it was", async ({ page }) => {
  await gotoReady(page, "/practice/inner-clock");
  await expect(page.getByText(/^Your target: \d+(\.\d)? seconds$/)).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  const tapArea = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expect(tapArea).toBeFocused();
  // Nothing on screen tells the time while it runs.
  await expect(page.getByRole("timer")).toHaveCount(0);
  await page.waitForTimeout(1000);
  await tapArea.click();

  // Targets are at least 3 s, so a tap after about 1 s is early by roughly 2 s or more.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/^\d+(\.\d+)? s early$/);
  await expect(page.getByText(/^You tapped at \d+(\.\d+)? s\. The target was \d+(\.\d)? s\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
});

test("the home page links to practice", async ({ page }) => {
  await gotoReady(page, "/");
  await page.getByRole("link", { name: "Practice first" }).click();
  await expect(page).toHaveURL("/practice/stacking");
});
