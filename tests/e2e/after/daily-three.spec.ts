import type { Page } from "@playwright/test";
import { METER_CACHE_SECONDS } from "../../../src/config/meter";
import { check } from "../../../src/lib/devData";
import { gameDateAt } from "../../../src/lib/gameDay";
import { expect, test } from "../support/fixtures";
import { gotoReady, signUpViaForm } from "../support/pages";
import { adminClient } from "../support/supabase";

/**
 * The Daily Three end to end (T165) on a lineup set here: Swift Sum, Second Sense, then Echo Path.
 * A target of 0 makes any run a win and 1000 makes it a loss, so each test decides its games. This
 * changes today's games for everyone, so it runs in its own project after the rest of the suite
 * (playwright.config.ts), one test at a time, and puts the day back afterwards. Each test's
 * account, and with it its attempts, is deleted when the test ends, which unlocks the targets.
 */
test.describe.configure({ mode: "serial" });

const db = adminClient();
const LINEUP = ["flash-count", "inner-clock", "echo-path"];
const WIN = 0;
const LOSE = 1000;
let before: { games: string[]; targets: number[]; threshold: number; edited: boolean };

const saveDay = async (games: string[], targets: number[]) =>
  check("Saving the lineup", await db.rpc("save_game_day", { d: gameDateAt(new Date()), games, targets, threshold: before.threshold }));

test.beforeAll(async () => {
  const today = gameDateAt(new Date());
  check("Preparing the game day", await db.rpc("ensure_game_day", { d: today }));
  const day = check("Game day", await db.from("game_days").select("survival_threshold, edited").eq("game_date", today).single()) as {
    survival_threshold: number;
    edited: boolean;
  };
  const games = check(
    "Lineup",
    await db.from("game_day_games").select("challenge_type, pass_target").eq("game_date", today).order("position"),
  );
  before = {
    games: games.map((game) => game.challenge_type),
    targets: games.map((game) => Number(game.pass_target)),
    threshold: Number(day.survival_threshold),
    edited: day.edited,
  };
});

test.afterAll(async () => {
  await saveDay(before.games, before.targets);
  check("Restoring edited", await db.from("game_days").update({ edited: before.edited }).eq("game_date", gameDateAt(new Date())));
});

const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });

/** Swift Sum: 999 misses round 1 by more than the 10-dot bank, so one answer ends the run (score 0). */
async function missSwiftSum(page: Page) {
  await expect(page.locator("canvas")).toHaveAttribute("data-showing", "dots", { timeout: 10_000 });
  await expect(page.locator("canvas")).toHaveAttribute("data-showing", "clear");
  await page.getByRole("textbox", { name: "How many dots were there?" }).fill("999");
  await page.getByRole("button", { name: "Submit" }).click();
}

/** Second Sense: a tap as round 1 starts misses its 15 s or longer target by more than the 10 s bank. */
async function rushSecondSense(page: Page) {
  const clock = page.locator("[data-clock]");
  const tapArea = page.getByRole("button", { name: /Tap when you think [\d.]+ seconds have passed/ });
  await expect(clock).toHaveAttribute("data-clock", "shown", { timeout: 10_000 });
  await tapArea.click();
}

/** Echo Path: three taps on the top row, where a path never starts, each a wrong first tile (score 0). */
async function missEchoPath(page: Page) {
  const board = page.getByRole("img", { name: /Get ready|Watch the tiles|Tap the tiles/ });
  const lives = page.getByRole("img", { name: /lives left$/ });
  // The first arrow shows the ring on the bottom row; nine more take it to the top.
  for (let i = 0; i < 10; i++) await board.press("ArrowUp");
  for (const left of [2, 1, 0]) {
    await expect(board).toHaveAttribute("data-phase", "repeat", { timeout: 15_000 });
    await board.press("Enter");
    if (left > 0) await expect(lives).toHaveAccessibleName(`${left} of 3 lives left`);
  }
}

/** A stand-in share sheet that keeps what it was given (as play.spec.ts does). */
async function stubShare(page: Page) {
  await page.addInitScript(() => {
    navigator.share = async (data) => {
      (window as unknown as { sharedText?: string }).sharedText = data?.text;
    };
  });
}

async function shareFromResults(page: Page): Promise<string> {
  await page.getByRole("region", { name: "Share your day" }).getByRole("button", { name: "Share" }).click();
  const sharedText = () => page.evaluate(() => (window as unknown as { sharedText?: string }).sharedText ?? "");
  await expect.poll(sharedText).not.toBe("");
  return sharedText();
}

test("win two of three: the day passes after game 2, the meter counts it, and game 3 leaves the result alone", async ({ page, accounts }) => {
  test.setTimeout(120_000);
  await saveDay(LINEUP, [WIN, WIN, LOSE]);
  const counters = await db.from("game_day_counters").select("completed_days").eq("game_date", gameDateAt(new Date())).maybeSingle();
  const finishedBefore = check("Counters", counters)?.completed_days ?? 0;
  await stubShare(page);
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");

  await gotoReady(page, "/play");
  await expect(heading(page, "Game 1 of 3: Swift Sum")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await missSwiftSum(page);
  await expect(heading(page, "Game 1 of 3: won")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(heading(page, "Game 2 of 3: Second Sense")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await rushSecondSense(page);
  await expect(heading(page, "Game 2 of 3: won")).toBeVisible();
  await expect(page.getByText("You passed today: two wins")).toBeVisible();
  // This player's decided day is the one more finished today; the meter keeps each reading for a
  // cache window (T48), so it can take that long to show.
  await expect
    .poll(async () => ((await (await page.request.get("/api/meter")).json()) as { completed?: number }).completed, {
      timeout: (METER_CACHE_SECONDS + 10) * 1000,
      intervals: [1000],
    })
    .toBe(finishedBefore + 1);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(heading(page, "You passed today: two wins")).toBeVisible();
  await page.getByRole("link", { name: "See results" }).click();
  await expect(page).toHaveURL("/play/results");
  await expect(heading(page, "You passed today: two wins")).toBeVisible();
  const sharedBefore = await shareFromResults(page);
  expect(sharedBefore).toContain("I passed today.\n✅✅⬜");

  await gotoReady(page, "/play");
  await expect(heading(page, "Game 3 of 3: Echo Path")).toBeVisible();
  await expect(page.getByText(/won't change the result/)).toBeVisible();
  await page.getByRole("button", { name: "Play it anyway" }).click();
  await missEchoPath(page);
  await expect(heading(page, "Game 3 of 3: lost")).toBeVisible();
  await page.getByRole("link", { name: "See results" }).click();

  // The day stays passed; only game 3's own row and square fill in.
  await expect(heading(page, "You passed today: two wins")).toBeVisible();
  await expect(page.getByRole("list", { name: "Today's games" }).getByRole("listitem").nth(2)).toContainText("Lost");
  const sharedAfter = await shareFromResults(page);
  expect(sharedAfter).toContain("I passed today.\n✅✅❌");
  expect(sharedAfter.split("\n")[0]).toBe(sharedBefore.split("\n")[0]);
  expect(sharedAfter).not.toContain("Perfect day");
});

test("two losses: the day fails after game 2, and the third game is still offered", async ({ page, accounts }) => {
  test.setTimeout(90_000);
  await saveDay(LINEUP, [LOSE, LOSE, WIN]);
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");

  await gotoReady(page, "/play");
  await page.getByRole("button", { name: "Start" }).click();
  await missSwiftSum(page);
  // The server scored the answers against the game's own target, in rounds.
  await expect(heading(page, "Game 1 of 3: lost")).toBeVisible();
  await expect(page.getByText("You scored 0 rounds. Today's target was 1000 rounds.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Start" }).click();
  await rushSecondSense(page);
  await expect(heading(page, "Game 2 of 3: lost")).toBeVisible();
  await expect(page.getByText("Not today: two losses")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(heading(page, "Not today: two losses")).toBeVisible();
  await expect(heading(page, "Game 3 of 3: Echo Path")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play it anyway" })).toBeVisible();
});

test("one attempt per game: a reload resumes the day, and a start after all three is refused", async ({ page, accounts }) => {
  await saveDay(LINEUP, [LOSE, LOSE, WIN]);
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  // Game 1 started and left.
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);

  await gotoReady(page, "/play");
  const games = page.getByRole("list", { name: "Today's games" }).getByRole("listitem");
  await expect(games.first()).toHaveText("Game 1: Swift SumLost");
  await expect(heading(page, "Game 2 of 3: Second Sense")).toBeVisible();
  await page.reload();
  await expect(heading(page, "Game 2 of 3: Second Sense")).toBeVisible();

  for (let game = 2; game <= 3; game++) expect((await page.request.post("/api/attempts/start")).status()).toBe(200);
  const fourth = await page.request.post("/api/attempts/start");
  expect(fourth.status()).toBe(409);
  expect(await fourth.json()).toEqual({ error: "day-complete" });

  await gotoReady(page, "/play");
  await expect(heading(page, "Not today: two losses")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Start|Play it anyway)$/ })).toHaveCount(0);
});
