import { gameDateAt } from "../../../src/lib/gameDay";
import { expect, test } from "../support/fixtures";
import { gotoReady, signUpViaForm } from "../support/pages";
import { adminClient, deleteUsersByEmail } from "../support/supabase";

/**
 * Today played as Swift Sum. It changes today's challenge for everyone, so it runs in its own
 * project after the rest of the suite (playwright.config.ts) and puts the day back afterwards.
 */
test("a scored Swift Sum day: start, see the dots, enter a count, see the server's result", async ({ page, accounts }) => {
  const today = gameDateAt(new Date());
  const db = adminClient();
  const before = await db.from("game_days").select("challenge_type, edited").eq("game_date", today).maybeSingle();
  if (before.error) throw before.error;
  // Marked edited, as an admin's choice would be, so the rotation (T31) leaves the day alone: the
  // other specs' accounts, and so their attempts, are gone by now, so the day looks untouched.
  const set = (challenge_type: string, edited: boolean) => db.from("game_days").update({ challenge_type, edited }).eq("game_date", today);
  if (before.data) {
    const changed = await set("flash-count", true);
    if (changed.error) throw changed.error;
  } else {
    const created = await db
      .from("game_days")
      .insert({ game_date: today, challenge_type: "flash-count", pass_target: 15, survival_threshold: 0.6, edited: true });
    if (created.error) throw created.error;
  }

  const email = accounts.uniqueEmail();
  try {
    await signUpViaForm(page, { email });
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
    // A started day's challenge is locked (T111): the account, and with it its attempt, goes first.
    await deleteUsersByEmail([email]);
    const restored = await set(before.data?.challenge_type ?? "stacking", before.data?.edited ?? false);
    if (restored.error) throw restored.error;
  }
});
