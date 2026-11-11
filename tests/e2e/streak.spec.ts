import { gameDateAt } from "../../src/lib/gameDay";
import { expect, test } from "./support/fixtures";
import { adminClient } from "./support/supabase";

/** The game date `days` before today's. */
function daysAgo(days: number): string {
  const date = new Date(`${gameDateAt(new Date())}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * The three days before today become two survived days and then a broken one, and the streak
 * history becomes just that run. This rewrites the local database's recent results (they are
 * test data); with today open, these are the newest closed days, so the history starts with them.
 */
async function seedThreeClosedDays() {
  const db = adminClient();
  const closedAt = new Date().toISOString();
  const day = (gameDate: string, rate: number, outcome: string) => ({
    game_date: gameDate,
    challenge_type: "stacking",
    pass_target: 10,
    survival_threshold: 0.6,
    final_pass_rate: rate,
    outcome,
    closed_at: closedAt,
  });
  const days = await db
    .from("game_days")
    .upsert([day(daysAgo(3), 0.81, "survived"), day(daysAgo(2), 0.74, "survived"), day(daysAgo(1), 0.52, "broken")]);
  if (days.error) throw days.error;
  const cleared = await db.from("streak_runs").delete().gte("id", 0);
  if (cleared.error) throw cleared.error;
  const run = await db.from("streak_runs").insert({ start_date: daysAgo(3), end_date: daysAgo(2), length: 2 });
  if (run.error) throw run.error;
}

test("the home page shows the world streak, and the history lists the closed days newest first", async ({ page }) => {
  await seedThreeClosedDays();

  await page.goto("/");
  const streak = page.getByRole("region", { name: "World streak" });
  await expect(streak.getByText("World streak: 0 days")).toBeVisible();
  await expect(streak.getByText("Best: 2")).toBeVisible();
  await expect(streak.getByText("Yesterday the streak broke at 52%")).toBeVisible();

  await streak.getByRole("link", { name: "Every day so far" }).click();
  await expect(page).toHaveURL("/history");
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toContainText("Teetering Tower");
  await expect(rows.nth(1)).toContainText("60%");
  await expect(rows.nth(1)).toContainText("52%");
  await expect(rows.nth(1)).toContainText("Broke");
  await expect(rows.nth(2)).toContainText("74%");
  await expect(rows.nth(2)).toContainText("Survived");
  await expect(rows.nth(3)).toContainText("81%");
  await expect(rows.nth(3)).toContainText("Survived");
});

test("a history page past the last one is not found", async ({ page }) => {
  const response = await page.goto("/history?page=9999");
  expect(response?.status()).toBe(404);
});
