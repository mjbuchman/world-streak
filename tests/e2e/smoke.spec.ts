import { expect, test } from "@playwright/test";

test("home page loads and shows the game name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "World Streak" })).toBeVisible();
});

test("home page uses the Fresh Sport tokens and fonts", async ({ page }) => {
  await page.goto("/");
  const look = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      mint: root.getPropertyValue("--fs-color-mint").trim(),
      tangerine: root.getPropertyValue("--fs-color-tangerine").trim(),
      bodyFont: getComputedStyle(document.body).fontFamily,
      background: getComputedStyle(document.body).backgroundImage,
    };
  });
  expect(look.mint.toLowerCase()).toBe("#34f5b5");
  expect(look.tangerine.toLowerCase()).toBe("#ff7a1a");
  expect(look.bodyFont).toMatch(/Manrope/i);
  expect(look.background).toMatch(/linear-gradient/);
});
