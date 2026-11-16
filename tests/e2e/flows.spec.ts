import type { StackingParams } from "../../src/challenges/stacking/engine";
import { FALL_MS } from "../../src/challenges/stacking/render";
import { METER_CACHE_SECONDS } from "../../src/config/meter";
import { removeFakePlayers, runSeed, supabaseSeedDeps } from "../../src/lib/devData";
import { gameDateAt } from "../../src/lib/gameDay";
import { expect, test } from "./support/fixtures";
import { gotoReady, signUpViaForm } from "./support/pages";
import { adminClient } from "./support/supabase";
import { playTaps, skipCountdown, tapsForAMiss } from "./support/tower";

// The day-survives half of T49 for today: the close half is tests/e2e/after/day-close.spec.ts.
const db = adminClient();

test.afterAll(async () => {
  await removeFakePlayers(db);
});

// Until T163 gives fake players a decided day, only the real player's day reaches the meter.
test("today: 10 fake players, then a new player loses two games, and the meter counts their decided day", async ({ page, accounts }) => {
  test.setTimeout(90_000);
  const today = gameDateAt(new Date());
  const counted = async () => {
    const { data, error } = await db.from("game_day_counters").select("completed_days").eq("game_date", today).maybeSingle();
    if (error) throw error;
    return data?.completed_days ?? 0;
  };
  const before = await counted();
  await runSeed({ players: 10, passRate: 0.7, date: null }, `flows-${Date.now()}`, supabaseSeedDeps(db, () => undefined));

  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await gotoReady(page, "/play");
  await page.clock.pauseAt(new Date("2026-01-01T00:00:30Z"));
  const started = page.waitForResponse("**/api/attempts/start");
  await page.getByRole("button", { name: "Start" }).click();
  const instance = (await (await started).json()) as { params: StackingParams };
  await skipCountdown(page);
  await playTaps(page, tapsForAMiss(instance.params));
  await page.clock.runFor(FALL_MS + 50);
  await expect(page.getByRole("heading", { level: 2, name: /^(Passed|Not this time)$/ })).toBeVisible();
  // Game 1 was a deliberate miss; game 2 started and left is the second loss that decides the day.
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);

  // Other specs play today too, so the meter counts at least this one more. The endpoint keeps
  // each reading for one cache window (T48), so the count can take that long to show.
  await expect
    .poll(async () => ((await (await page.request.get("/api/meter")).json()) as { completed?: number }).completed ?? 0, {
      timeout: (METER_CACHE_SECONDS + 10) * 1000,
      intervals: [1000],
    })
    .toBeGreaterThanOrEqual(before + 1);
});
