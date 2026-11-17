import { simulate, type StackingParams } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { expect, test } from "./support/fixtures";
import { gotoReady, signUpViaForm } from "./support/pages";
import { reachedRow, targetRow } from "../../src/components/stacking/rows";
import { playTaps, skipCountdown, tapsForAMiss } from "./support/tower";
import { adminClient, findUserByEmail } from "./support/supabase";

test("the home page offers today's challenge and practice", async ({ page }) => {
  await gotoReady(page, "/");
  await expect(page.getByRole("region", { name: "Teetering Tower" }).getByText("Your part today")).toBeVisible();
  await page.getByRole("link", { name: "Play today's challenge" }).click();
  await expect(page).toHaveURL("/play");
});

test("a run finished after the attempt was submitted elsewhere shows the stored result (T69)", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/play");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  const started = page.waitForResponse("**/api/attempts/start");
  await page.getByRole("button", { name: "Start" }).click();
  const instance = (await (await started).json()) as { attemptId: string; params: StackingParams };
  await expect(page.getByRole("status")).toHaveText("Row 1");

  // The same attempt is submitted from "another tab" while this one still runs.
  const taps = tapsForAMiss(instance.params);
  // The server refuses taps later than the attempt has really run (plus 2 s); the page's clock is
  // paused, so wait in real time (as attempts.spec.ts does).
  await page.waitForTimeout(Math.max(0, taps.at(-1)! - 1_000));
  const elsewhere = await page.request.post("/api/attempts/submit", { data: { attemptId: instance.attemptId, inputs: { tapsMs: taps } } });
  expect(elsewhere.status()).toBe(200);

  // This tab finishes its run; its own submission is refused as already submitted, and the
  // refreshed page shows the stored result instead of hanging on "Checking your result".
  await skipCountdown(page);
  await playTaps(page, taps);
  await page.clock.runFor(FALL_MS + 50);
  // The refreshed day lists game 1 as stored, with game 2 next.
  const games = page.getByRole("list", { name: "Today's games" }).getByRole("listitem");
  await expect(games.first()).toHaveText(/^Game 1: Teetering Tower(Won|Lost)$/);
  await expect(page.getByRole("heading", { name: /^Game 2 of 3: / })).toBeVisible();
  const { data: stored } = await adminClient().from("attempts").select("score").eq("id", instance.attemptId).single();
  expect(stored?.score).toBe(simulate(instance.params, taps).score);
});

test("a signed-out visitor is asked to sign in, or to practice", async ({ page }) => {
  await gotoReady(page, "/play");
  const main = page.getByRole("main");
  await expect(main.getByText("Sign in to play today's three games.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  await expect(main.getByRole("link", { name: "Practice" })).toHaveAttribute("href", "/practice/stacking");
  await expect(main.getByRole("button", { name: "Start" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Back", exact: true })).toHaveAttribute("href", "/");
});

test("a signed-in player without a profile is sent to complete it", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  const user = await findUserByEmail(email);
  const { error } = await adminClient().from("profiles").delete().eq("id", user!.id);
  if (error) throw error;

  await gotoReady(page, "/play");
  await expect(page).toHaveURL("/complete-profile");
});

test("a player loses game 1 on purpose, sees the server's result, and after a reload is offered game 2", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");

  // A paused clock drives the game, so the taps land at exactly known times however long the
  // start request takes (an installed clock otherwise keeps running in real time).
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/play");
  await expect(page.getByRole("heading", { name: "Game 1 of 3: Teetering Tower" })).toBeVisible();
  await expect(page.getByText(/Win two of the three games to pass the day/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Practice first" })).toHaveAttribute("href", "/practice/stacking");
  // A way back before the run, none during it (leaving mid-run would lose the attempt).
  const back = page.getByRole("main").getByRole("link", { name: "Back", exact: true });
  await expect(back).toHaveAttribute("href", "/");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  const started = page.waitForResponse("**/api/attempts/start");
  await page.getByRole("button", { name: "Start" }).click();
  const instance = (await (await started).json()) as { attemptId: string; gameDate: string; params: StackingParams };
  await expect(page.getByRole("status")).toHaveText("Row 1");
  // Today's target, as stored on the game day the start created.
  const { data: day } = await adminClient().from("game_days").select("pass_target").eq("game_date", instance.gameDate).single();
  const passTarget = Number(day!.pass_target);
  await expect(page.getByText(`Row ${passTarget} to pass`)).toBeVisible();
  await expect(back).toBeHidden();
  // No header link one stray tap away either (UI rule 8; leaving would lose the attempt).
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeHidden();
  // Never an ad while the challenge runs (T44).
  await expect(page.locator("[data-ad-slot]")).toHaveCount(0);

  // A run that ends on a deliberate miss, worked out from the instance the server issued.
  const taps = tapsForAMiss(instance.params);
  const expected = simulate(instance.params, taps);
  expect(expected.endReason).toBe("miss");
  const score = expected.score;
  await skipCountdown(page);
  await playTaps(page, taps);
  // The missed row falls away before the result appears.
  await page.clock.runFor(FALL_MS + 50);

  const verdict = page.getByRole("heading", { name: "Game 1 of 3: lost" });
  await expect(verdict).toBeVisible();
  await expect(verdict).toBeFocused();
  const summary = page.getByText(`${reachedRow(score)}. Today's target was ${targetRow(passTarget)}.`);
  await expect(summary).toBeVisible();
  // The wording itself, independent of rows.ts.
  await expect(summary).toHaveText(/^You reached row \d+\. Today's target was row \d+\.$/);
  await expect(page.locator("[data-big-score]")).toHaveText(String(score));
  // The human's layout (second play-test): the big score above the verdict.
  const bigScore = page.locator("[data-big-score]");
  await expect(bigScore).toBeVisible();
  await expect(verdict).toBeVisible();
  const [scoreBox, verdictBox] = [await bigScore.boundingBox(), await verdict.boundingBox()];
  expect(scoreBox).not.toBeNull();
  expect(verdictBox).not.toBeNull();
  expect(scoreBox?.y ?? Infinity).toBeLessThan(verdictBox?.y ?? -Infinity);
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByText("The day so far: 0 wins, 1 loss.")).toBeVisible();
  // What was shown is what the server stored: the engine's score for exactly those taps.
  const { data: stored } = await adminClient().from("attempts").select("score, passed").eq("id", instance.attemptId).single();
  expect(stored).toEqual({ score, passed: false });

  // After a reload the day resumes from the server: game 1 lost, game 2 offered.
  await page.reload();
  const games = page.getByRole("list", { name: "Today's games" }).getByRole("listitem");
  await expect(games).toHaveCount(3);
  await expect(games.first()).toHaveText("Game 1: Teetering TowerLost");
  await expect(page.getByRole("heading", { name: /^Game 2 of 3: / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
});

test("a game started and left counts as lost, with the next one offered", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);

  await gotoReady(page, "/play");
  await expect(
    page.getByText(
      "You started game 1 but haven't finished it here. If it's still open in another tab, finish it there before the day ends. Otherwise it counts as lost.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Today's games" }).getByRole("listitem").first()).toHaveText("Game 1: Teetering TowerLost");
  await expect(page.getByRole("heading", { name: /^Game 2 of 3: / })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
});

test("a decided day's results: the verdict, three rows and the share card, also after a reload",async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  // Not decided yet: the results belong to /play.
  await gotoReady(page, "/play/results");
  await expect(page).toHaveURL("/play");
  // A stand-in share sheet that keeps what it was given.
  await page.addInitScript(() => {
    navigator.share = async (data) => {
      (window as unknown as { sharedText?: string }).sharedText = data?.text;
    };
  });

  // Games 1 and 2 started and left: two losses decide the day.
  for (let game = 1; game <= 2; game++) expect((await page.request.post("/api/attempts/start")).status()).toBe(200);
  await gotoReady(page, "/play");
  await expect(page.getByRole("heading", { name: "Not today: two losses" })).toBeVisible();
  await expect(page.getByText(/won't change the result/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play it anyway" })).toBeVisible();
  await page.getByRole("link", { name: "See results" }).click();

  await expect(page).toHaveURL("/play/results");
  await expect(page.getByRole("heading", { name: "Not today: two losses" })).toBeVisible();
  const rows = page.getByRole("list", { name: "Today's games" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Lost");
  await expect(rows.nth(1)).toContainText("Lost");
  await expect(rows.nth(2)).toContainText("Not played");
  await expect(rows.nth(2)).toContainText("Today's target was");
  // The share card (T32, T115): just the button; the text it shares has the outcome, never a
  // score or a target.
  const share = page.getByRole("region", { name: "Share your day" });
  await expect(share).toHaveText("Share");
  await share.getByRole("button", { name: "Share" }).click();
  const sharedText = () => page.evaluate(() => (window as unknown as { sharedText?: string }).sharedText ?? "");
  await expect.poll(sharedText).toContain("I didn't make it today.");
  expect(await sharedText()).not.toMatch(/row|score|target/i);

  // A reload shows the same page.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Not today: two losses" })).toBeVisible();
  await expect(rows).toHaveCount(3);
});

test("a signed-out visitor to the results is asked to sign in", async ({ page }) => {
  await gotoReady(page, "/play/results");
  const main = page.getByRole("main");
  await expect(main.getByText("Sign in to see your results for today.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
});
