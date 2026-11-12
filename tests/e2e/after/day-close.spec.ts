import type { Page } from "@playwright/test";
import { removeFakePlayers, runSeed, supabaseSeedDeps } from "../../../src/lib/devData";
import { addDays, gameDateAt } from "../../../src/lib/gameDay";
import { dayLabel } from "../../../src/lib/streak/streak";
import { expect, test } from "../support/fixtures";
import { gotoReady } from "../support/pages";
import { adminClient } from "../support/supabase";

/**
 * The main flows end to end (T49): a day that survives and one that breaks, through the real
 * close job. A day closes only after its deadline, so these close yesterday, reopened and
 * seeded here (a player cannot play a past day; tests/e2e/flows.spec.ts plays today). They
 * rewrite yesterday and the streak, so they run after the rest of the suite and one at a time.
 */
test.describe.configure({ mode: "serial" });

const db = adminClient();
const yesterday = () => addDays(gameDateAt(new Date()), -1);
const seedDeps = () => supabaseSeedDeps(db, () => undefined);
const run = (label: string) => `${label}-${Date.now()}`;

async function must<T>(step: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await step;
  if (error) throw new Error(error.message);
  return data;
}

/** Yesterday open and empty with a 60% threshold, every day before it closed, and no streak. */
async function reopenYesterday(): Promise<string> {
  const day = yesterday();
  await must(db.from("game_days").update({ closed_at: new Date().toISOString(), outcome: "broken" }).is("closed_at", null).lt("game_date", day));
  await must(db.from("attempts").delete().eq("game_date", day));
  await must(db.from("game_day_counters").delete().eq("game_date", day));
  await must(db.rpc("ensure_game_day", { d: day }));
  await must(
    db
      .from("game_days")
      .update({ closed_at: null, outcome: null, final_pass_rate: null, challenge_type: "stacking", survival_threshold: 0.6, edited: true })
      .eq("game_date", day),
  );
  await must(db.from("streak_runs").delete().gte("id", 0));
  return day;
}

async function closeDay(day: string): Promise<string> {
  return (await must(db.rpc("close_game_day", { d: day }))) as string;
}

const streakCard = (page: Page) => page.getByRole("region", { name: "World streak" });

test.afterAll(async () => {
  await removeFakePlayers(db);
});

test("a day survives: 7 of 10 pass, the close adds a day to the streak and the history says survived", async ({ page }) => {
  const day = await reopenYesterday();
  await runSeed({ players: 10, passRate: 0.7, date: day }, run("survive"), seedDeps());
  expect(await closeDay(day)).toBe("survived");

  await gotoReady(page, "/");
  await expect(streakCard(page).getByText(/^1 day$/)).toBeVisible();
  await gotoReady(page, "/history");
  const first = page.getByRole("row").nth(1);
  await expect(first).toContainText(dayLabel(day));
  await expect(first).toContainText("70%");
  await expect(first).toContainText("Survived");
});

test("a day breaks: half pass, under the 60% threshold, so the streak is 0 days", async ({ page }) => {
  const day = await reopenYesterday();
  // A streak of 1 going in, from the day before, so the break visibly resets it.
  await must(db.from("streak_runs").insert({ start_date: addDays(day, -1), length: 1 }));
  await runSeed({ players: 10, passRate: 0.5, date: day }, run("break"), seedDeps());
  expect(await closeDay(day)).toBe("broken");

  await gotoReady(page, "/");
  await expect(streakCard(page).getByText(/^0 days$/)).toBeVisible();
  await gotoReady(page, "/history");
  await expect(page.getByRole("row").nth(1)).toContainText("Broke");
});
