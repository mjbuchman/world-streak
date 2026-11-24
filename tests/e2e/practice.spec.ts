import type { Locator, Page } from "@playwright/test";
import { COLS, paramsFromSeed as echoPathParams, ROWS } from "../../src/challenges/echo-path/engine";
import { boardLayout } from "../../src/challenges/echo-path/render";
import { paramsFromSeed as fairSplitParams } from "../../src/challenges/fair-split/engine";
import { paramsFromSeed as flashCountParams } from "../../src/challenges/flash-count/engine";
import { ROUND_GAP_MS } from "../../src/challenges/inner-clock/engine";
import { paramsFromSeed, simulate } from "../../src/challenges/stacking/engine";
import { RUN_COUNTDOWN_MS } from "../../src/config/countdown";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { reachedRow } from "../../src/components/stacking/rows";
import { expect, test } from "./support/fixtures";
import { countdownOffsets, gotoReady } from "./support/pages";
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
  await expect(bank).toHaveAttribute("aria-valuenow", "4000");
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
  // Round 1's target is at least 10 s and the clock has just hidden (about 2 s in), so a tap now
  // misses by more than the 4 s bank.
  await tapArea.click();

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 rounds survived");
  await expect(page.getByText(/^0 s of your 4 s time bank left\.$/)).toBeVisible();
  // A bank game shows no big score (T225), unlike the Tower.
  await expect(page.locator("[data-big-score]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  expect(scored).toEqual([]);
});

test("Second Sense practice: a tap near the target survives round 1, and round 2 has its own 3-2-1 (T197)", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/practice/inner-clock");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("img", { name: "Round 1 of 4" })).toBeVisible();
  const prompt = page.getByText(/^Tap when you think [\d.]+ seconds have passed$/);
  const targetMs = Number(/([\d.]+) seconds/.exec((await prompt.textContent())!)![1]) * 1000;

  // The 3-2-1, then the round's clock starts; a tap at the target costs next to nothing.
  await page.clock.runFor(RUN_COUNTDOWN_MS + 100);
  const tapArea = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expect(tapArea).toBeVisible();
  await page.clock.runFor(targetMs);
  await tapArea.press("Space");
  await expect(page.getByRole("meter", { name: "Time bank" })).toHaveAttribute("aria-valuetext", /^\d+\.\d s left of 4\.0 s$/);

  // After the error shows, round 2 starts with its own 3-2-1.
  await page.clock.runFor(ROUND_GAP_MS + 100);
  await expect(page.getByRole("img", { name: "Round 2 of 4" })).toBeVisible();
  await expect(page.getByText("Round 2", { exact: true })).toBeVisible();
  await expect(page.locator("[data-countdown]")).toBeVisible();
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

  for (const [game, path] of [
    ["Second Sense", "/practice/inner-clock"],
    ["Swift Sum", "/practice/flash-count"],
  ]) {
    test(`${game} centres its 3-2-1 in the slot and the board at ${size.width} x ${size.height} (T203)`, async ({ page }) => {
      await page.setViewportSize(size);
      // No pop animation, so the glyph is measured at its resting size.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoReady(page, path);
      await page.getByRole("button", { name: "Start" }).click();
      await expect(page.locator("[data-countdown]")).toBeVisible();
      const off = await countdownOffsets(page);
      expect(Math.max(off.slotX, off.slotY, off.boardX)).toBeLessThanOrEqual(2);
    });
  }
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
  // Round 1 has at most 25 dots, so 999 misses by far more than the 10-dot bank.
  await answer.fill("999");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(bank).toHaveAttribute("aria-valuetext", "Bank used up");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 rounds survived");
  await expect(page.getByText("0 dots of your 10-dot bank left.")).toBeVisible();
  await expect(page.locator("[data-big-score]")).toHaveCount(0);
  expect(scored).toEqual([]);
});

test("Swift Sum practice: ten runs never flash more than 25 dots in round 1 (T218, T226)", async ({ page }) => {
  test.setTimeout(150_000);
  await gotoReady(page, "/practice/flash-count");
  const board = page.locator("canvas");
  const reveal = page.getByText(/^Off by \d+$/);
  for (let run = 0; run < 10; run++) {
    await page.getByRole("button", { name: run === 0 ? "Start" : "Play again" }).click();
    await expect(board).toHaveAttribute("data-showing", "clear", { timeout: 10_000 });
    // An answer of 99 is off by 99 less the count, and busts the 10-dot bank at once.
    await page.getByRole("textbox", { name: "How many dots were there?" }).fill("99");
    await page.getByRole("button", { name: "Submit" }).click();
    const count = 99 - Number(/\d+/.exec((await reveal.textContent())!)![0]);
    expect(count).toBeGreaterThanOrEqual(10);
    expect(count).toBeLessThanOrEqual(25);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("0 rounds survived");
  }
});

test("Swift Sum practice: five steps, and a close count survives round 1 into round 2's 3-2-1 (T197)", async ({ page }) => {
  const seed = 2024;
  await pinSeed(page, seed);
  const firstCount = flashCountParams(seed).levels[0].dotCount;
  await gotoReady(page, "/practice/flash-count");
  await page.getByRole("button", { name: "Start" }).click();
  const counter = page.getByRole("img", { name: "Round 1 of 5" });
  await expect(counter).toBeVisible();
  // The counter (T224): five numbers joined by four bars, none lit yet.
  await expect(counter.locator("[data-step]")).toHaveText(["1", "2", "3", "4", "5"]);
  await expect(counter.locator('[data-bar="unlit"]')).toHaveCount(4);
  const board = page.locator("canvas");
  await expect(board).toHaveAttribute("data-showing", "dots", { timeout: 10_000 });
  await expect(board).toHaveAttribute("data-showing", "clear");
  // Off by one: well inside the 10-dot bank.
  await page.getByRole("textbox", { name: "How many dots were there?" }).fill(String(firstCount + 1));
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("meter", { name: "Dot bank" })).toHaveAttribute("aria-valuetext", "9 dots left of 10 dots");
  const next = page.getByRole("img", { name: "Round 2 of 5" });
  await expect(next).toBeVisible();
  // Round 1 passed: its number and the bar after it light up.
  await expect(next.locator("[data-step]").first()).toHaveAttribute("data-step", "done");
  await expect(next.locator("[data-bar]").first()).toHaveAttribute("data-bar", "lit");
  await expect(next.locator('[data-bar="unlit"]')).toHaveCount(3);
  await expect(page.getByText("Round 2", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[data-countdown]")).toBeVisible();
});

/** The middle of a Trail Trace tile on the page (tiles count row by row from the bottom). */
function tileCentre(box: { x: number; y: number; width: number; height: number }, tile: number) {
  const layout = boardLayout(box.width, box.height, COLS, ROWS);
  const pitch = layout.tileSize + layout.gap;
  const col = tile % COLS;
  const fromTop = ROWS - 1 - Math.floor(tile / COLS);
  return {
    x: box.x + layout.left + layout.gap + col * pitch + layout.tileSize / 2,
    y: box.y + layout.top + layout.gap + fromTop * pitch + layout.tileSize / 2,
  };
}

test("Trail Trace practice: a 4-tile first playback on the 5 x 8 board, and a fifth tile after a clear (T197, T208)", async ({ page }) => {
  const seed = 2024;
  await pinSeed(page, seed);
  const params = echoPathParams(seed);
  await gotoReady(page, "/practice/echo-path");
  await page.getByRole("button", { name: "Start" }).click();
  const board = page.locator("canvas[data-phase]");
  const length = page.getByRole("img", { name: /^Tile \d+ of \d+$/ });
  await expect(length).toHaveAccessibleName(`Tile 4 of ${params.path.length}`);
  await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
  // Tapping the path's first four tiles, placed on a 5 x 8 grid, clears the round.
  const box = (await board.boundingBox())!;
  for (const tile of params.path.slice(0, 4)) {
    const { x, y } = tileCentre(box, tile);
    await page.mouse.click(x, y);
  }
  await expect(length).toHaveAccessibleName(`Tile 5 of ${params.path.length}`);
  await expect(page.locator("[data-cleared]")).toHaveCount(4);
  await expect(page.getByRole("img", { name: /lives left$/ })).toHaveAccessibleName("2 of 2 lives left");
});

test("Trail Trace practice: watch, then wrong tiles use up the lives and end the run", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/echo-path");
  await page.getByRole("button", { name: "Start" }).click();
  const board = page.getByRole("img", { name: /Get ready|Watch the tiles|Tap the tiles/ });
  const lives = page.getByRole("img", { name: /lives left$/ });
  await expect(lives).toHaveAccessibleName("2 of 2 lives left");
  // The first arrow shows the ring on the bottom row; nine more take it to the top row, where a
  // path never starts. Each Enter there is a wrong first tile and costs a life (T190).
  for (let i = 0; i < 10; i++) await board.press("ArrowUp");
  for (const left of [1, 0]) {
    await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
    await board.press("Enter");
    // (After the last life the game, and its lives, give way to the result.)
    if (left > 0) await expect(lives).toHaveAccessibleName(`${left} of 2 lives left`);
  }
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("No path repeated");
  await expect(page.getByText("0 of 2 lives left. Score: 0.")).toBeVisible();
  expect(scored).toEqual([]);
});

test("Clean Cut practice: an 8 point bank; the line moves twice without cutting; Cut shows the pieces and both sides' percentages (T213)", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/fair-split");
  await expect(page.getByRole("heading", { level: 1, name: "Practice: Clean Cut" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("meter", { name: "Split bank" })).toHaveAttribute("aria-valuetext", "8 points left of 8 points");
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
  // And again, from where it now is, back a little to the left.
  await page.mouse.move(middle.x + 20, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 8, middle.y, { steps: 8 });
  await page.mouse.up();
  await expect(board).toHaveAttribute("data-phase", "cut");
  await page.getByRole("button", { name: "Cut" }).click();
  await expect(board).toHaveAttribute("data-phase", "result");
  await expect(page.getByText(/^\d+\.\d% and \d+\.\d%\./)).toBeVisible();
  expect(scored).toEqual([]);
});

test("Clean Cut practice: each run draws new shapes (T221, T226)", async ({ page }) => {
  // Record, without changing, each seed the page draws for a run. Start draws the run's seed with
  // one Uint32Array(1) (`secureRandomSeed`), so the last one recorded after Start is that run's.
  await page.addInitScript(() => {
    const real = crypto.getRandomValues.bind(crypto);
    const seeds: number[] = [];
    (window as unknown as { seeds: number[] }).seeds = seeds;
    crypto.getRandomValues = (<T extends ArrayBufferView>(array: T): T => {
      real(array);
      if (array instanceof Uint32Array && array.length === 1) seeds.push(array[0]);
      return array;
    }) as Crypto["getRandomValues"];
  });
  // Two attempts, each on a fresh load of the page.
  const runs: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    await gotoReady(page, "/practice/fair-split");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("canvas[data-phase]")).toHaveAttribute("data-phase", "cut", { timeout: 10_000 });
    const seeds = await page.evaluate(() => (window as unknown as { seeds: number[] }).seeds);
    expect(seeds.length).toBeGreaterThan(0);
    runs.push(JSON.stringify(fairSplitParams(seeds.at(-1)!).shapes.map((shape) => shape.polygon)));
  }
  expect(runs[0]).not.toBe(runs[1]);
});

test("Bank Shot practice: a 14-unit bank, the puck's glimpse, then a marker locked in reveals the crossing (T245)", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/bank-shot");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("img", { name: "Round 1 of 5" })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Distance bank" })).toHaveAttribute("aria-valuetext", "14 left of 14");
  const board = page.locator("canvas[data-phase]");
  await expect(board).toHaveAttribute("data-phase", "glimpse", { timeout: 10_000 });
  await expect(board).toHaveAttribute("data-phase", "aim");
  const box = (await board.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Lock in" }).click();
  await expect(board).toHaveAttribute("data-phase", "result");
  await expect(page.getByText(/^(Right on the crossing\.|[\d.]+ units? off\.)/)).toBeVisible();
  expect(scored).toEqual([]);
});

test("Arrow Flip practice: a time bank, a prompt after the 3-2-1, and an answer by key shows feedback (T246)", async ({ page }) => {
  const scored = attemptRequests(page);
  await gotoReady(page, "/practice/arrow-flip");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("meter", { name: "Time bank" })).toHaveAttribute("aria-valuetext", /^\d\.\d s left of \d\.\d s$/);
  const board = page.locator("canvas[data-phase]");
  await expect(board).toHaveAttribute("data-phase", "prompt", { timeout: 10_000 });
  await expect(page.getByRole("img", { name: "Prompt 1 of 6, round 1" })).toBeVisible();
  await page.getByRole("button", { name: "Left" }).click();
  await expect(page.getByText(/^(Right|Wrong\. It was [A-Z]+\.|Too slow\. It was [A-Z]+\.)$/)).toBeVisible();
  expect(scored).toEqual([]);
});

test("the practice hub opens each challenge's practice page", async ({ page }) => {
  for (const [name, path, heading] of [
    ["Teetering Tower", "/practice/stacking", "Practice: Teetering Tower"],
    ["Second Sense", "/practice/inner-clock", "Practice: Second Sense"],
    ["Swift Sum", "/practice/flash-count", "Practice: Swift Sum"],
    ["Trail Trace", "/practice/echo-path", "Practice: Trail Trace"],
    ["Clean Cut", "/practice/fair-split", "Practice: Clean Cut"],
    ["Bank Shot", "/practice/bank-shot", "Practice: Bank Shot"],
    ["Arrow Flip", "/practice/arrow-flip", "Practice: Arrow Flip"],
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
