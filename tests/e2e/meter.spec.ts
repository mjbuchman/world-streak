import { METER_HIDE_HOURS } from "../../src/config/meter";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";

// A short public cache, or no-store in the final second before the reading goes out of date.
const PUBLIC_CACHE = /^(?:public, s-maxage=(\d+), stale-while-revalidate=\1|no-store)$/;

// With no hidden window (T103) the meter is open at every hour. If METER_HIDE_HOURS is switched
// back on, its status depends on the hour, so these check whichever applies.
const ALWAYS_OPEN = METER_HIDE_HOURS === 0;

test("the meter answers anyone with today's reading, cached publicly", async ({ request }) => {
  const response = await request.get("/api/meter");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(PUBLIC_CACHE);
  expect(response.headers()["set-cookie"]).toBeUndefined();

  const body = await response.json();
  expect(body.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(body.closesAt).getTime()).toBeGreaterThan(Date.now());
  if (ALWAYS_OPEN) expect(body.status).toBe("open");
  if (body.status === "open") {
    expect(Object.keys(body).sort()).toEqual(["attempts", "closesAt", "gameDate", "passRate", "status", "streak", "threshold"]);
    expect(Number.isInteger(body.attempts)).toBe(true);
  } else {
    expect(body.status).toBe("hidden");
    expect(Object.keys(body).sort()).toEqual(["closesAt", "gameDate", "status", "streak", "threshold"]);
  }
  // The world streak, from the real world_streak() (T21), in either status.
  expect(Object.keys(body.streak).sort()).toEqual(["best", "current"]);
  expect(Number.isInteger(body.streak.current) && body.streak.best >= body.streak.current).toBe(true);
});

test("the home page shows the live meter, or the hidden message in the final hours", async ({ page }) => {
  await page.goto("/");
  const meter = page.getByRole("region", { name: "Today's meter" });
  const reading = ALWAYS_OPEN ? /% needed|No attempts yet/ : /% needed|No attempts yet|The meter is hidden for the final/;
  await expect(meter.getByText(reading)).toBeVisible();
  await expect(meter.getByRole("timer")).toHaveText(/^Closes in \d+:\d{2}:\d{2}$/);
});

test("a signed-in player's meter request carries no cookie, and a started attempt shows in it", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  // page.request sends the player's session cookies; the shared answer must not set any.
  expect((await page.request.post("/api/attempts/start")).status()).toBe(200);

  const response = await page.request.get("/api/meter");
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers()["cache-control"]).toMatch(PUBLIC_CACHE);

  const body = await response.json();
  // The start created today's game day, so its threshold is known either way.
  expect(body.threshold).toBeGreaterThan(0);
  if (ALWAYS_OPEN) expect(body.status).toBe("open");
  if (body.status === "open") {
    // The counters reach the meter through the server, although players cannot read them.
    expect(body.attempts).toBeGreaterThanOrEqual(1);
    expect(body.passRate).not.toBeNull();
  }
});
