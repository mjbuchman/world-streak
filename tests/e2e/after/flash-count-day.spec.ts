import { gameDateAt } from "../../../src/lib/gameDay";
import { expect, test } from "../support/fixtures";
import { gotoReady, signUpViaForm } from "../support/pages";
import { adminClient } from "../support/supabase";

/**
 * Today played as Swift Sum. It changes today's challenge for everyone, so it runs in its own
 * project after the rest of the suite (playwright.config.ts) and puts the day back afterwards.
 */
test("a scored Swift Sum day: start, see the dots, enter a count, see the server's result", async ({ page, accounts }) => {
  const today = gameDateAt(new Date());
  const db = adminClient();
  const before = await db.from("game_days").select("challenge_type").eq("game_date", today).maybeSingle();
  if (before.error) throw before.error;
  const set = (challenge_type: string) => db.from("game_days").update({ challenge_type }).eq("game_date", today);
  if (before.data) {
    const changed = await set("flash-count");
    if (changed.error) throw changed.error;
  } else {
    const created = await db.from("game_days").insert({ game_date: today, challenge_type: "flash-count", pass_target: 15, survival_threshold: 0.6 });
    if (created.error) throw created.error;
  }

  try {
    await signUpViaForm(page, { email: accounts.uniqueEmail() });
    await expect(page).toHaveURL("/");
    await gotoReady(page, "/play");
    await expect(page.getByRole("heading", { level: 1, name: "Swift Sum" })).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.locator("canvas")).toHaveAttribute("data-showing", "dots");
    await expect(page.locator("canvas")).toHaveAttribute("data-showing", "clear");
    await page.getByRole("textbox", { name: "How many dots were there?" }).fill("20");
    await page.getByRole("button", { name: "Submit" }).click();

    // The server scored the count against today's target.
    await expect(page.getByRole("heading", { level: 2, name: /^(Passed|Not this time)$/ })).toBeVisible();
    await expect(page.getByText(/^You were \d+(\.\d+)?% off\. Today's target was within \d+(\.\d+)?%\.$/)).toBeVisible();
  } finally {
    const restored = await set(before.data?.challenge_type ?? "stacking");
    if (restored.error) throw restored.error;
  }
});
