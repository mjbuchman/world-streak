import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

test("the home page offers today's challenge and practice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Play today's challenge; if enough of the world passes, humanity's streak survives.")).toBeVisible();
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
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Blocks: 0");

  // The seed is random, so the taps cannot be aimed. Two quick drops end the run: each block
  // starts at the opposite edge, so the second one, dropped at once, misses the first.
  await page.clock.runFor(50);
  await page.keyboard.press("Space");
  await page.clock.runFor(50);
  await page.keyboard.press("Space");
  await page.clock.runFor(100);

  const verdict = page.getByRole("heading", { name: /^(Passed|Not this time)$/ });
  await expect(verdict).toBeVisible();
  await expect(verdict).toBeFocused();
  const summary = page.getByText(/^You stacked \d+ blocks?\. Today's target was \d+ blocks?\.$/);
  await expect(summary).toBeVisible();
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
  await expect(page.getByText("You left today's attempt before finishing. It was not counted. Come back tomorrow.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});
