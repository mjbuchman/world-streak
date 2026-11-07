import { expect, test } from "@playwright/test";

test("home page loads and shows the game name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "World Streak" })).toBeVisible();
});

test("home page uses the generated Material color tokens", async ({ page }) => {
  await page.goto("/");
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--md-sys-color-primary").trim(),
  );
  expect(primary).toMatch(/^#[0-9a-f]{6}$/);
});
