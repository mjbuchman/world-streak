import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";

// The local-only admin from supabase/seed.sql.
const ADMIN = { email: "admin@local.test", password: "admin-local-only" };

test("the seeded admin sees today and the next 7 game days", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  const days = page.getByRole("region", { name: "Coming game days" });
  // A header row plus the 8 days.
  await expect(days.getByRole("row")).toHaveCount(9);
  await expect(days.getByRole("row").nth(1)).toContainText("Open");
});

test("a signed-out visitor gets a 404", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

test("a signed-in player who is not an admin gets a 404", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});
