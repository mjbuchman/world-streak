import { paramsFromSeed } from "../../src/challenges/stacking/engine";
import { gameDateAt } from "../../src/lib/gameDay";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

test("a signed-out request to start an attempt is refused", async ({ request }) => {
  const response = await request.post("/api/attempts/start");
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});

test("an eligible player starts today's attempt once; a second start is refused", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");

  // page.request shares the browser's session cookies.
  const before = gameDateAt(new Date());
  const first = await page.request.post("/api/attempts/start");
  const after = gameDateAt(new Date());
  expect(first.status()).toBe(200);
  const body = await first.json();
  expect(body.challengeType).toBe("stacking");
  // A run that crosses the deadline could see either date.
  expect([before, after]).toContain(body.gameDate);
  expect(body.params).toEqual(paramsFromSeed(body.seed));

  // The database row holds the same seed the player was given.
  const user = await findUserByEmail(email);
  const { data: rows, error } = await adminClient().from("attempts").select("id, seed, submitted_at").eq("user_id", user!.id);
  if (error) throw error;
  expect(rows).toEqual([{ id: body.attemptId, seed: body.seed, submitted_at: null }]);

  const second = await page.request.post("/api/attempts/start");
  expect(second.status()).toBe(409);
  expect(await second.json()).toEqual({ error: "already-started", submitted: false });
});

test("the server scores a submission itself and accepts it only once", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  const { attemptId } = await (await page.request.post("/api/attempts/start")).json();

  const invalid = await page.request.post("/api/attempts/submit", { data: { attemptId, inputs: { tapsMs: [900, 800] } } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "invalid-inputs" });

  const unknown = await page.request.post("/api/attempts/submit", {
    data: { attemptId: "6f1c7d0e-2b9a-4c3e-8d5f-1a2b3c4d5e6f", inputs: { tapsMs: [] } },
  });
  expect(unknown.status()).toBe(404);

  // Claims a pass, but no taps stack no blocks.
  const submitted = await page.request.post("/api/attempts/submit", {
    data: { attemptId, inputs: { tapsMs: [] }, score: 99, passed: true },
  });
  expect(submitted.status()).toBe(200);
  // 10 is the placeholder target ensure_game_day gives a new day (see DECISIONS, T11).
  expect(await submitted.json()).toEqual({ score: 0, passed: false, passTarget: 10 });

  const { data: row, error } = await adminClient()
    .from("attempts")
    .select("inputs, score, passed, submitted_at")
    .eq("id", attemptId)
    .single();
  if (error) throw error;
  expect(row).toMatchObject({ inputs: { tapsMs: [] }, score: 0, passed: false });
  expect(row.submitted_at).not.toBeNull();

  const again = await page.request.post("/api/attempts/submit", { data: { attemptId, inputs: { tapsMs: [] } } });
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "already-submitted" });

  const restart = await page.request.post("/api/attempts/start");
  expect(await restart.json()).toEqual({ error: "already-started", submitted: true });
});

test("a signed-out submission is refused", async ({ request }) => {
  const response = await request.post("/api/attempts/submit", { data: { attemptId: "x", inputs: {} } });
  expect(response.status()).toBe(401);
});

test("two simultaneous starts create exactly one attempt", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");

  const responses = await Promise.all([page.request.post("/api/attempts/start"), page.request.post("/api/attempts/start")]);
  expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);

  const user = await findUserByEmail(email);
  const { count, error } = await adminClient()
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);
  if (error) throw error;
  expect(count).toBe(1);
});

test("a signed-in account without a profile cannot start an attempt", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  const user = await findUserByEmail(email);
  const { error } = await adminClient().from("profiles").delete().eq("id", user!.id);
  if (error) throw error;

  const response = await page.request.post("/api/attempts/start");
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "profile-required" });
});
