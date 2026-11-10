import { expect, test } from "./support/fixtures";

test("practice tower works signed out, ends with a score and offers another go", async ({ page }) => {
  const attemptRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/attempts")) attemptRequests.push(request.url());
  });
  // A controllable clock drives performance.now() and requestAnimationFrame, so taps land at
  // exact times and the one-minute run can be skipped through.
  await page.clock.install();
  await page.goto("/practice/stacking");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Row 1");
  for (let tap = 0; tap < 3; tap++) {
    await page.clock.runFor(400);
    await page.keyboard.press("Space");
  }
  // The last drop's Space is still held down when the run ends.
  await page.clock.runFor(400);
  await page.keyboard.down("Space");
  await page.clock.runFor(61_000);

  const result = page.getByRole("heading", { name: /^You stacked \d+ blocks?$/ });
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

test("the home page links to practice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Practice first" }).click();
  await expect(page).toHaveURL("/practice/stacking");
});
