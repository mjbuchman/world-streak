import { addDays, gameDateAt } from "../../src/lib/gameDay";
import { dayLabel } from "../../src/lib/streak/streak";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { adminClient } from "./support/supabase";

// These tests move cycle 1 to cover today, one state after another, then put it back.
test.describe.configure({ mode: "serial" });

const CYCLE_1 = { start_date: "2027-01-01", end_date: "2027-03-01", rollover_in_cents: 0, goal_reached_on: null };

async function setCycle1(values: Partial<Record<keyof typeof CYCLE_1, string | number | null>>) {
  const updated = await adminClient().from("cycles").update(values).eq("number", 1);
  if (updated.error) throw updated.error;
}

/** Day 10 of a cycle that started nine days ago. */
function midCycle() {
  const start = addDays(gameDateAt(new Date()), -9);
  return { start_date: start, end_date: addDays(start, 59) };
}

test.afterAll(async () => {
  await setCycle1(CYCLE_1);
});

test("before the first cycle, the home page says when it starts and the prize", async ({ page }) => {
  await setCycle1(CYCLE_1);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Prize" })).toHaveText("The first cycle starts January 1, 2027. Prize: $200.");
});

test("mid-cycle, a signed-in player sees the prize with its rollover, the day, the goal and their entries", async ({ page, accounts }) => {
  await setCycle1({ ...midCycle(), rollover_in_cents: 20_000, goal_reached_on: null });
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  const prize = page.getByRole("region", { name: "Prize" });
  await expect(prize.getByText("Prize this cycle: $400, including $200 rolled over")).toBeVisible();
  await expect(prize.getByText("Day 10 of 60")).toBeVisible();
  await expect(prize.getByText("Goal: a 30-day world streak")).toBeVisible();
  await expect(prize.getByText("Your entries this cycle: 0")).toBeVisible();
});

test("once the goal is reached, the home page says so and that a winner comes after the cycle", async ({ page }) => {
  const yesterday = addDays(gameDateAt(new Date()), -1);
  await setCycle1({ ...midCycle(), rollover_in_cents: 0, goal_reached_on: yesterday });
  await page.goto("/");
  const prize = page.getByRole("region", { name: "Prize" });
  await expect(prize.getByText(`Goal reached on ${dayLabel(yesterday)}. A winner will be drawn after the cycle ends.`)).toBeVisible();
  await expect(prize.getByText("Goal: a 30-day world streak")).toHaveCount(0);
  // Signed out: no entry count.
  await expect(prize.getByText(/Your entries/)).toHaveCount(0);
});
