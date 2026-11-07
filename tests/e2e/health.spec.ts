import { expect, test } from "@playwright/test";

test("health endpoint reaches the local database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ db: "ok" });
});
