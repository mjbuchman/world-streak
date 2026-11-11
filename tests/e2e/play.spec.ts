import { simulate, type StackingParams } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { reachedRow, targetRow } from "../../src/components/stacking/rows";
import { playTaps, tapsForAMiss } from "./support/tower";
import { adminClient, findUserByEmail } from "./support/supabase";

test("the home page offers today's challenge and practice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Teetering Tower" }).getByText("Your part today")).toBeVisible();
  await page.getByRole("link", { name: "Play today's challenge" }).click();
  await expect(page).toHaveURL("/play");
});

test("a signed-out visitor is asked to sign in, or to practice", async ({ page }) => {
  await page.goto("/play");
  const main = page.getByRole("main");
  await expect(main.getByText("Sign in to play today's scored attempt.")).toBeVisible();
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

  await page.goto("/play");
  await expect(page).toHaveURL("/complete-profile");
});

test("a player plays today's attempt once and sees the server's result, also after a reload", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");

  // A paused clock drives the game, so the taps land at exactly known times however long the
  // start request takes (an installed clock otherwise keeps running in real time).
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/play");
  await expect(page.getByText(/one scored attempt today/)).toBeVisible();
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

  // A run that ends on a deliberate miss, worked out from the instance the server issued.
  const taps = tapsForAMiss(instance.params);
  const expected = simulate(instance.params, taps);
  expect(expected.endReason).toBe("miss");
  const score = expected.score;
  await playTaps(page, taps);
  // The missed row falls away before the result appears.
  await page.clock.runFor(FALL_MS + 50);

  const verdict = page.getByRole("heading", { name: "Not this time" });
  await expect(verdict).toBeVisible();
  await expect(verdict).toBeFocused();
  const summary = page.getByText(`${reachedRow(score)}. Today's target was ${targetRow(passTarget)}.`);
  await expect(summary).toBeVisible();
  // The wording itself, independent of rows.ts.
  await expect(summary).toHaveText(/^You reached row \d+\. Today's target was row \d+\.$/);
  await expect(page.locator("[data-big-score]")).toHaveText(String(score));
  // The human's layout (second play-test): the big score above the verdict.
  const scoreTop = (await page.locator("[data-big-score]").boundingBox())!.y;
  expect(scoreTop).toBeLessThan((await verdict.boundingBox())!.y);
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  // What was shown is what the server stored: the engine's score for exactly those taps.
  const { data: stored } = await adminClient().from("attempts").select("score, passed").eq("id", instance.attemptId).single();
  expect(stored).toEqual({ score, passed: false });
  const shownVerdict = await verdict.textContent();
  const shownSummary = await summary.textContent();

  // The page shows the same stored result (verdict and numbers) after a reload, with no way to play again.
  await page.reload();
  await expect(page.getByRole("heading", { name: shownVerdict!, exact: true })).toBeVisible();
  await expect(page.getByText(shownSummary!)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

  const again = await page.request.post("/api/attempts/start");
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "already-started", submitted: true });
});

test("a player who left an attempt unfinished cannot start again", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);

  await page.goto("/play");
  await expect(
    page.getByText("You left today's attempt before finishing, so it counted as not passed. Come back tomorrow."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});
