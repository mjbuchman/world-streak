import type { Page } from "@playwright/test";
import { addDays, gameDateAt } from "../../src/lib/gameDay";
import { dayLabel } from "../../src/lib/streak/streak";
import { expect, test } from "./support/fixtures";
import { gotoReady, signUpViaForm, submitAndWait } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

// The local-only admin from supabase/seed.sql.
const ADMIN = { email: "admin@local.test", password: "admin-local-only" };

async function signInAsAdmin(page: Page) {
  await gotoReady(page, "/signin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await submitAndWait(page, page.getByRole("button", { name: "Sign in" }));
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
    await gotoReady(page, "/admin");
    const threshold = page.getByRole("spinbutton", { name: `Survival threshold in percent for ${dayLabel(tomorrow)}` });
    await threshold.fill("55");
    const row = page.getByRole("row").filter({ has: threshold });
    await submitAndWait(page, row.getByRole("button", { name: "Save" }));
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

test("an admin gives a coming day another challenge, and it takes that challenge's target", async ({ page }) => {
  // The last day listed, so no other test plays it.
  const day = addDays(gameDateAt(new Date()), 7);
  const db = adminClient();
  const before = await db.from("game_days").select("challenge_type, pass_target, edited").eq("game_date", day).maybeSingle();
  if (before.error) throw before.error;
  try {
    await signInAsAdmin(page);
    await gotoReady(page, "/admin");
    const select = page.getByRole("combobox", { name: `Challenge for ${dayLabel(day)}` });
    const other = (await select.inputValue()) === "flash-count" ? "inner-clock" : "flash-count";
    await select.selectOption(other);
    const row = page.getByRole("row").filter({ has: select });
    await submitAndWait(page, row.getByRole("button", { name: "Save" }));
    await expect(row.getByRole("status")).toContainText(`Saved ${dayLabel(day)}. It is now`);

    const after = await db.from("game_days").select("challenge_type, pass_target, edited").eq("game_date", day).single();
    if (after.error) throw after.error;
    expect(after.data).toMatchObject({ challenge_type: other, edited: true });
    await expect(page.getByRole("spinbutton", { name: `Pass target for ${dayLabel(day)}` })).toHaveValue(String(after.data.pass_target));
  } finally {
    if (before.data) {
      await db.from("game_days").update(before.data).eq("game_date", day);
    } else {
      await db.from("game_days").update({ edited: false }).eq("game_date", day);
    }
  }
});

test("an admin clears their own attempt today with the local tools, and can play again", async ({ page }) => {
  const db = adminClient();
  const today = gameDateAt(new Date());
  try {
    await signInAsAdmin(page);
    // An attempt today (new, or one the admin already has locally): /play then offers no second go.
    expect([200, 409]).toContain((await page.request.post("/api/attempts/start")).status());
    await gotoReady(page, "/play");
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

    await gotoReady(page, "/admin");
    const tools = page.getByRole("region", { name: "Local tools" });
    await submitAndWait(page, tools.getByRole("button", { name: "Clear my attempt today" }));
    await expect(tools.getByRole("status")).toHaveText("Your attempt today is gone. You can play again.");

    await gotoReady(page, "/play");
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  } finally {
    // If the tool failed, do not leave the shared admin with an attempt today.
    const admin = await findUserByEmail(ADMIN.email);
    if (admin) await db.from("attempts").delete().eq("user_id", admin.id).eq("game_date", today);
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
