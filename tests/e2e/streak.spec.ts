import { gameDateAt } from "../../src/lib/gameDay";
import { dayLabel } from "../../src/lib/streak/streak";
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
  const results = [
    { game_date: daysAgo(3), final_pass_rate: 0.81, outcome: "survived" },
    { game_date: daysAgo(2), final_pass_rate: 0.74, outcome: "survived" },
    { game_date: daysAgo(1), final_pass_rate: 0.52, outcome: "broken" },
  ];
  // Create missing days, but never rewrite an existing day's pass target: once a day has
  // attempts (earlier local runs) the database refuses to move it (T102).
  const created = await db
    .from("game_days")
    .upsert(
      results.map(({ game_date }) => ({ game_date, challenge_type: "stacking", pass_target: 10, survival_threshold: 0.6 })),
      { ignoreDuplicates: true },
    );
  if (created.error) throw created.error;
  for (const { game_date, ...result } of results) {
    const closed = await db
      .from("game_days")
      .update({ ...result, challenge_type: "stacking", survival_threshold: 0.6, closed_at: closedAt })
      .eq("game_date", game_date);
    if (closed.error) throw closed.error;
  }
  const cleared = await db.from("streak_runs").delete().gte("id", 0);
  if (cleared.error) throw cleared.error;
  const run = await db.from("streak_runs").insert({ start_date: daysAgo(3), end_date: daysAgo(2), length: 2 });
  if (run.error) throw run.error;
}

test("the home page shows the world streak, and the history lists the closed days newest first", async ({ page }) => {
  await seedThreeClosedDays();

  await page.goto("/");
  const streak = page.getByRole("region", { name: "World streak" });
  await expect(streak.getByText("0", { exact: true })).toBeVisible();
  await expect(streak.getByText("days", { exact: true })).toBeVisible();
  await expect(streak.getByText("Best 2")).toBeVisible();
  await expect(streak.getByText("Yesterday the streak broke at 52%")).toBeVisible();
  // The 14-day chart ends with the three seeded days; screen readers get them as a list.
  const days = streak.getByRole("list", { name: "The last 14 days" }).getByRole("listitem");
  await expect(days).toHaveCount(14);
  await expect(days.nth(11)).toHaveText(`${dayLabel(daysAgo(3))}: 81% passed, 60% needed, survived`);
  await expect(days.nth(13)).toHaveText(`${dayLabel(daysAgo(1))}: 52% passed, 60% needed, broke the streak`);

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
