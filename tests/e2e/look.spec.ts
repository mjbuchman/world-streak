import { paramsFromSeed } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { CANVAS_COLOR_TOKENS, FLASH_COUNT_COLOR_TOKENS } from "../../src/components/canvasTokens";
import { expect, test } from "./support/fixtures";
import { gotoReady, signUpViaForm } from "./support/pages";
import { pinSeed, playTaps, tapsForAMiss } from "./support/tower";

// Checks only a real browser can make (jsdom has no layout, CSS or canvas): focus visibility,
// busy buttons, touch-target size and the game's colour tokens.

test("the main button shows the mint focus ring when reached with the keyboard", async ({ page }) => {
  await gotoReady(page, "/practice/stacking");
  const start = page.getByRole("button", { name: "Start" });
  // Tab until Start has focus (the header and back button come first).
  for (let i = 0; i < 10 && !(await start.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(start).toBeFocused();
  // The ring is mint (52, 245, 181), drawn over the tangerine glow; wait out the shadow's
  // short transition before reading it.
  await expect.poll(() => start.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(52, 245, 181)");
});

test("a busy Start keeps its name and its focus while the request is in flight", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  // Hold the start request so the busy state can be inspected.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/attempts/start", async (route) => {
    await held;
    await route.continue();
  });

  await gotoReady(page, "/play");
  const start = page.getByRole("button", { name: "Start" });
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(start).toHaveAttribute("aria-busy", "true");
  await expect(start).toBeFocused();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(1);
  // Let the request finish, so the test ends cleanly with the game running.
  release();
  await expect(page.getByRole("img", { name: /game area/ })).toBeVisible();
});

test("the back button is at least 44 by 44 px and goes home", async ({ page }) => {
  await gotoReady(page, "/practice/stacking");
  const back = page.getByRole("main").getByRole("link", { name: "Back", exact: true });
  const box = await back.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(page).toHaveURL("/");
});

test("the back button hides during a run and returns with the result", async ({ page }) => {
  const seed = 4242;
  await pinSeed(page, seed);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/practice/stacking");
  const back = page.getByRole("main").getByRole("link", { name: "Back", exact: true });
  await expect(back).toBeVisible();
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("img", { name: /game area/ })).toBeVisible();
  await expect(back).toBeHidden();
  // Still hidden while the player takes their time (no time limit), until a miss ends the run.
  await page.clock.runFor(20_000);
  await expect(back).toBeHidden();
  const taps = tapsForAMiss(paramsFromSeed(seed), [], 20_001);
  await page.clock.runFor(taps[0] - 20_000);
  await page.keyboard.press("Space");
  await playTaps(page, taps.map((tap) => tap - taps[0]).slice(1));
  await page.clock.runFor(FALL_MS + 50);
  const heading = page.getByRole("heading", { name: /^You reached row/ });
  await expect(heading).toBeVisible();
  await expect(back).toBeVisible();
  // The stylesheet colours a practice result mint by its data-tone (T88).
  await expect(heading).toHaveCSS("color", "rgb(52, 245, 181)");
});

for (const { game, path, canvasName, names } of [
  { game: "Teetering Tower", path: "/practice/stacking", canvasName: /Teetering Tower game area/, names: Object.values(CANVAS_COLOR_TOKENS) },
  { game: "Swift Sum", path: "/practice/flash-count", canvasName: /Get ready|Count the dots|The dots are gone/, names: Object.values(FLASH_COUNT_COLOR_TOKENS) },
]) {
  test(`the ${game} canvas finds its colour tokens`, async ({ page }) => {
    await gotoReady(page, path);
    await page.getByRole("button", { name: "Start" }).click();
    const canvas = page.getByRole("img", { name: canvasName });
    await expect(canvas).toBeVisible();
    const tokens = await canvas.evaluate((el, list) => list.map((name) => getComputedStyle(el).getPropertyValue(name).trim()), names);
    expect(tokens).toHaveLength(names.length);
    for (const value of tokens) expect(value).not.toBe("");
  });
}
