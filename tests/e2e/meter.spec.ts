import { expect, test } from "@playwright/test";

// The meter is public and its status depends on the hour (hidden in the final 3 hours before
// midnight UTC), so this checks the shape against the real database for whichever applies.
test("the meter answers anyone with today's reading, cached publicly", async ({ request }) => {
  const response = await request.get("/api/meter");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("public, s-maxage=30, stale-while-revalidate=30");
  expect(response.headers()["set-cookie"]).toBeUndefined();

  const body = await response.json();
  expect(body.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(new Date(body.closesAt).getTime()).toBeGreaterThan(Date.now());
  if (body.status === "open") {
    expect(Object.keys(body).sort()).toEqual(["attempts", "closesAt", "gameDate", "passRate", "status", "streak", "threshold"]);
    expect(Number.isInteger(body.attempts)).toBe(true);
    if (body.passRate !== null) expect(body.passRate).toBeGreaterThanOrEqual(0);
  } else {
    expect(body.status).toBe("hidden");
    expect(Object.keys(body).sort()).toEqual(["closesAt", "gameDate", "status", "threshold"]);
  }
});
