import type { Page } from "@playwright/test";
import { addDays, gameDateAt } from "../../src/lib/gameDay";
import { dayLabel } from "../../src/lib/streak/streak";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { adminClient } from "./support/supabase";

// The local-only admin from supabase/seed.sql.
const ADMIN = { email: "admin@local.test", password: "admin-local-only" };

async function signInAsAdmin(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("the seeded admin sees today and the next 7 game days", async ({ page }) => {
  await signInAsAdmin(page);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  const days = page.getByRole("region", { name: "Coming game days" });
  // A header row plus the 8 days.
  await expect(days.getByRole("row")).toHaveCount(9);
  await expect(days.getByRole("button", { name: "Save" })).toHaveCount(8);
});

test("an admin changes tomorrow's survival threshold to 55%, and it stays saved", async ({ page }) => {
  const tomorrow = addDays(gameDateAt(new Date()), 1);
  const db = adminClient();
  const before = await db.from("game_days").select("survival_threshold, edited").eq("game_date", tomorrow).maybeSingle();
  if (before.error) throw before.error;
  try {
    await signInAsAdmin(page);
    await page.goto("/admin");
    const threshold = page.getByRole("spinbutton", { name: `Survival threshold in percent for ${dayLabel(tomorrow)}` });
    await threshold.fill("55");
    const row = page.getByRole("row").filter({ has: threshold });
    await row.getByRole("button", { name: "Save" }).click();
    await expect(row.getByRole("status")).toHaveText(`Saved ${dayLabel(tomorrow)}.`);

    await page.reload();
    await expect(page.getByRole("spinbutton", { name: `Survival threshold in percent for ${dayLabel(tomorrow)}` })).toHaveValue("55");
  } finally {
    // Tomorrow becomes today for other tests: put it back as it was (the page created it if missing).
    if (before.data) {
      await db.from("game_days").update(before.data).eq("game_date", tomorrow);
    } else {
      await db.from("game_days").update({ edited: false }).eq("game_date", tomorrow);
    }
  }
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
