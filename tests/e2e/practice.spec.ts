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
  await expect(page.getByRole("status")).toHaveText("Blocks: 0");
  for (let tap = 0; tap < 3; tap++) {
    await page.clock.runFor(400);
    await page.keyboard.press("Space");
  }
  await page.clock.runFor(61_000);

  await expect(page.getByRole("heading", { name: /^You stacked \d+ blocks?$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("status")).toHaveText("Blocks: 0");
  expect(attemptRequests).toEqual([]);
});

test("the home page links to practice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Practice the tower" }).click();
  await expect(page).toHaveURL("/practice/stacking");
});
