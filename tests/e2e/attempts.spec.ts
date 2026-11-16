import { paramsFromSeed, simulate } from "../../src/challenges/stacking/engine";
import { tapsForAMiss } from "./support/tower";
import { gameDateAt } from "../../src/lib/gameDay";
import { expect, test } from "./support/fixtures";
import { signUpViaForm } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

test("a signed-out request to start an attempt is refused", async ({ request }) => {
  const response = await request.post("/api/attempts/start");
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthenticated" });
});

/** Today's lineup, in order, as the database holds it. */
async function lineup(gameDate: string) {
  const { data, error } = await adminClient()
    .from("game_day_games")
    .select("position, challenge_type, pass_target")
    .eq("game_date", gameDate)
    .order("position");
  if (error) throw error;
  return data.map((game) => ({ position: game.position, challengeType: game.challenge_type, passTarget: Number(game.pass_target) }));
}

test("an eligible player starts today's games in lineup order, each once, then no more (T154)", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");

  // page.request shares the browser's session cookies.
  const before = gameDateAt(new Date());
  const first = await page.request.post("/api/attempts/start");
  const after = gameDateAt(new Date());
  expect(first.status()).toBe(200);
  const body = await first.json();
  // Game 1 is pinned to the Tower for the run (global-setup.ts).
  expect(body).toMatchObject({ position: 1, challengeType: "stacking" });
  // A run that crosses the deadline could see either date.
  expect([before, after]).toContain(body.gameDate);
  expect(body.params).toEqual(paramsFromSeed(body.seed));

  // The database row holds the same seed the player was given.
  const user = await findUserByEmail(email);
  const { data: rows, error } = await adminClient().from("attempts").select("id, position, seed, submitted_at").eq("user_id", user!.id);
  if (error) throw error;
  expect(rows).toEqual([{ id: body.attemptId, position: 1, seed: body.seed, submitted_at: null }]);
  // Each game's target comes with its instance, read from the lineup the start just created.
  const games = await lineup(body.gameDate);
  expect(games).toHaveLength(3);
  expect(body.passTarget).toBe(games[0].passTarget);

  // Game 1 was left unfinished (it stays a loss); the next starts are games 2 and 3.
  for (const game of games.slice(1)) {
    const next = await page.request.post("/api/attempts/start");
    expect(next.status()).toBe(200);
    expect(await next.json()).toMatchObject({ ...game, gameDate: body.gameDate });
  }
  const done = await page.request.post("/api/attempts/start");
  expect(done.status()).toBe(409);
  expect(await done.json()).toEqual({ error: "day-complete" });
});

test("the server scores a submission itself and accepts it only once", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  const { attemptId, params, gameDate } = await (await page.request.post("/api/attempts/start")).json();
  // A short finished run on the issued instance. The server refuses taps later than the attempt
  // has really been running (its own clock, plus 2 s), so this test waits in real time until
  // the last tap is no longer in the future; a fake browser clock cannot help here.
  const tapsMs = tapsForAMiss(params);
  const score = simulate(params, tapsMs).score;
  await page.waitForTimeout(Math.max(0, tapsMs.at(-1)! - 1_000));

  const invalid = await page.request.post("/api/attempts/submit", { data: { attemptId, inputs: { tapsMs: [900, 800] } } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: "invalid-inputs" });
  // Taps that stop before the run ended are not a real submission either.
  const unfinished = await page.request.post("/api/attempts/submit", { data: { attemptId, inputs: { tapsMs: [] } } });
  expect(unfinished.status()).toBe(400);
  expect(await unfinished.json()).toEqual({ error: "invalid-inputs" });

  const unknown = await page.request.post("/api/attempts/submit", {
    data: { attemptId: "6f1c7d0e-2b9a-4c3e-8d5f-1a2b3c4d5e6f", inputs: { tapsMs } },
  });
  expect(unknown.status()).toBe(404);

  // Claims a pass; the server scores the taps itself.
  const submitted = await page.request.post("/api/attempts/submit", {
    data: { attemptId, inputs: { tapsMs }, score: 99, passed: true },
  });
  expect(submitted.status()).toBe(200);
  // Judged against game 1's stored target (it follows recent scores and admin edits, T22, T99);
  // a deliberate miss stacks far fewer rows than any target the game can have.
  const { passTarget } = (await lineup(gameDate))[0];
  expect(score).toBeLessThan(passTarget);
  // The day so far comes back too: one loss, game 2 next.
  expect(await submitted.json()).toEqual({ score, passed: false, passTarget, day: { wins: 0, losses: 1, outcome: null, nextPosition: 2 } });

  const { data: row, error } = await adminClient()
    .from("attempts")
    .select("inputs, score, passed, submitted_at")
    .eq("id", attemptId)
    .single();
  if (error) throw error;
  expect(row).toMatchObject({ inputs: { tapsMs }, score, passed: false });
  expect(row.submitted_at).not.toBeNull();

  const again = await page.request.post("/api/attempts/submit", { data: { attemptId, inputs: { tapsMs } } });
  expect(again.status()).toBe(409);
  expect(await again.json()).toEqual({ error: "already-submitted" });

  // Game 1 cannot be played again; a start moves on to game 2.
  const restart = await page.request.post("/api/attempts/start");
  expect(await restart.json()).toMatchObject({ position: 2 });
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
