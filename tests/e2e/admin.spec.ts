import type { Page } from "@playwright/test";
import { addDays, gameDateAt } from "../../src/lib/gameDay";
import { dayLabel } from "../../src/lib/streak/streak";
import { expect, test } from "./support/fixtures";
import { gotoReady, signUpViaForm, submitAndWait } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

// Each test signs in and loads several admin pages; a cold local dev server under a full parallel
// run can take longer than the default 30 s to compile them.
test.describe.configure({ timeout: 60_000 });

// The local-only admin from supabase/seed.sql.
const ADMIN = { email: "admin@local.test", password: "admin-local-only" };

async function signInAsAdmin(page: Page) {
  await gotoReady(page, "/signin");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await submitAndWait(page, page.getByRole("button", { name: "Sign in" }));
  await expect(page).toHaveURL("/");
}

test("the seeded admin sees today and the next 7 game days", async ({ page }) => {
  await signInAsAdmin(page);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  const days = page.getByRole("region", { name: "Coming game days" });
  // A header row plus the 8 days.
  await expect(days.getByRole("row")).toHaveCount(9);
  await expect(days.getByRole("button", { name: "Save" })).toHaveCount(8);
});

test("an admin changes tomorrow's survival threshold to 55%, and it stays saved", async ({ page }) => {
  const tomorrow = addDays(gameDateAt(new Date()), 1);
  const db = adminClient();
  const before = await db.from("game_days").select("survival_threshold, edited").eq("game_date", tomorrow).maybeSingle();
  if (before.error) throw before.error;
  try {
    await signInAsAdmin(page);
    await gotoReady(page, "/admin");
    const threshold = page.getByRole("spinbutton", { name: `Survival threshold in percent for ${dayLabel(tomorrow)}` });
    await threshold.fill("55");
    const row = page.getByRole("row").filter({ has: threshold });
    await submitAndWait(page, row.getByRole("button", { name: "Save" }));
    await expect(row.getByRole("status")).toHaveText(`Saved ${dayLabel(tomorrow)}.`);

    await page.reload();
    await expect(page.getByRole("spinbutton", { name: `Survival threshold in percent for ${dayLabel(tomorrow)}` })).toHaveValue("55");
  } finally {
    // Tomorrow becomes today for other tests: put it back as it was (the page created it if missing).
    if (before.data) {
      await db.from("game_days").update(before.data).eq("game_date", tomorrow);
    } else {
      await db.from("game_days").update({ edited: false }).eq("game_date", tomorrow);
    }
  }
});

test("an admin gives a coming day another challenge, and it takes that challenge's target", async ({ page }) => {
  // The last day listed, so no other test plays it.
  const day = addDays(gameDateAt(new Date()), 7);
  const db = adminClient();
  const before = await db.from("game_days").select("challenge_type, pass_target, edited").eq("game_date", day).maybeSingle();
  if (before.error) throw before.error;
  try {
    await signInAsAdmin(page);
    await gotoReady(page, "/admin");
    const select = page.getByRole("combobox", { name: `Challenge for ${dayLabel(day)}` });
    const other = (await select.inputValue()) === "flash-count" ? "inner-clock" : "flash-count";
    await select.selectOption(other);
    const row = page.getByRole("row").filter({ has: select });
    await submitAndWait(page, row.getByRole("button", { name: "Save" }));
    await expect(row.getByRole("status")).toContainText(`Saved ${dayLabel(day)}. It is now`);

    const after = await db.from("game_days").select("challenge_type, pass_target, edited").eq("game_date", day).single();
    if (after.error) throw after.error;
    expect(after.data).toMatchObject({ challenge_type: other, edited: true });
    await expect(page.getByRole("spinbutton", { name: `Pass target for ${dayLabel(day)}` })).toHaveValue(String(after.data.pass_target));
  } finally {
    if (before.data) {
      await db.from("game_days").update(before.data).eq("game_date", day);
    } else {
      await db.from("game_days").update({ edited: false }).eq("game_date", day);
    }
  }
});

test("an admin clears their own attempt today with the local tools, and can play again", async ({ page }) => {
  const db = adminClient();
  const today = gameDateAt(new Date());
  try {
    await signInAsAdmin(page);
    // An attempt today (new, or one the admin already has locally): /play then offers no second go.
    expect([200, 409]).toContain((await page.request.post("/api/attempts/start")).status());
    await gotoReady(page, "/play");
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

    await gotoReady(page, "/admin");
    const tools = page.getByRole("region", { name: "Local tools" });
    await submitAndWait(page, tools.getByRole("button", { name: "Clear my attempt today" }));
    await expect(tools.getByRole("status")).toHaveText("Your attempt today is gone. You can play again.");

    await gotoReady(page, "/play");
    await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  } finally {
    // If the tool failed, do not leave the shared admin with an attempt today.
    const admin = await findUserByEmail(ADMIN.email);
    if (admin) await db.from("attempts").delete().eq("user_id", admin.id).eq("game_date", today);
  }
});

test("an admin dismisses a player's only flag, and the player's entry is back in the draw", async ({ page, accounts }) => {
  const db = adminClient();
  // A day far ahead, so the attempt below touches no day another test plays or counts.
  const day = addDays(gameDateAt(new Date()), 400);
  const email = accounts.uniqueEmail();
  const created = await db.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  try {
    const steps = [
      await db.from("profiles").insert({ id: userId, birth_date: "1990-01-01", country: "US" }),
      await db.rpc("ensure_game_day", { d: day }),
    ];
    for (const step of steps) if (step.error) throw step.error;
    const attempt = await db.from("attempts").insert({ user_id: userId, game_date: day, seed: 1 }).select("id").single();
    if (attempt.error) throw attempt.error;
    const setup = [
      await db.from("attempts").update({ submitted_at: new Date().toISOString(), score: 12, passed: true }).eq("id", attempt.data.id),
      await db.from("entries").insert({ attempt_id: attempt.data.id, user_id: userId, cycle_number: 1, game_date: day }),
      await db.rpc("record_cheat_flags", { p_attempt_id: attempt.data.id, p_reasons: ["timing-mismatch"] }),
    ];
    for (const step of setup) if (step.error) throw step.error;
    const drawable = async () => {
      const { count, error } = await db.from("drawable_entries").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (error) throw error;
      return count;
    };
    expect(await drawable()).toBe(0);

    await signInAsAdmin(page);
    await gotoReady(page, "/admin");
    await page.getByRole("link", { name: "Cheat flags" }).click();
    await expect(page).toHaveURL("/admin/flags");
    const row = page.getByRole("row").filter({ hasText: email });
    await submitAndWait(page, row.getByRole("button", { name: `Dismiss timing-mismatch for ${email}` }));
    // The page refreshes after a review; a dismissed flag is no longer open, so its row goes.
    await expect(row).toHaveCount(0);
    await expect.poll(drawable).toBe(1);
  } finally {
    // Deleting the player removes the attempt, entry and flag; then the far day itself.
    await db.auth.admin.deleteUser(userId);
    await db.from("game_day_counters").delete().eq("game_date", day);
    await db.from("game_days").delete().eq("game_date", day);
  }
});

test("an admin draws the winner of a finished, won cycle once, sees who won and marks the prize paid", async ({ page, accounts }) => {
  const db = adminClient();
  // A cycle of its own, long past, so it overlaps no real cycle and no test that moves cycle 1.
  const cycle = { number: 900, start_date: "1990-01-01", end_date: "1990-03-01", goal_reached_on: "1990-01-30" };
  const day = "1990-01-05";
  const email = accounts.uniqueEmail();
  const created = await db.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  try {
    for (const step of [
      await db.from("profiles").insert({ id: userId, birth_date: "1990-01-01", country: "US" }),
      await db.from("cycles").insert(cycle),
      await db.rpc("ensure_game_day", { d: day }),
    ]) {
      if (step.error) throw step.error;
    }
    const attempt = await db.from("attempts").insert({ user_id: userId, game_date: day, seed: 1 }).select("id").single();
    if (attempt.error) throw attempt.error;
    for (const step of [
      await db.from("attempts").update({ submitted_at: new Date().toISOString(), score: 12, passed: true }).eq("id", attempt.data.id),
      await db.from("entries").insert({ attempt_id: attempt.data.id, user_id: userId, cycle_number: cycle.number, game_date: day }),
      // Closed again, so an open day this early never holds up the daily close.
      await db.from("game_days").update({ closed_at: new Date().toISOString(), outcome: "broken" }).eq("game_date", day),
    ]) {
      if (step.error) throw step.error;
    }

    await signInAsAdmin(page);
    await gotoReady(page, "/admin");
    await expect(page.getByRole("link", { name: "Prize draw" })).toHaveAttribute("href", "/admin/draw");
    // Straight there: the first visit to a route can compile for longer than a click's wait.
    await gotoReady(page, "/admin/draw");
    const draw = page.getByRole("button", { name: "Draw cycle 900" });
    await submitAndWait(page, draw);
    await expect(page.getByRole("row").filter({ has: draw }).getByRole("status")).toHaveText("Cycle 900 drawn.");
    await expect(draw).toBeDisabled();

    const stored = await db.from("cycles").select("winner_user_id, drawn_at").eq("number", cycle.number).single();
    if (stored.error) throw stored.error;
    expect(stored.data.winner_user_id).toBe(userId);
    expect(stored.data.drawn_at).not.toBeNull();

    // T125: the winner's email (confirmed at creation), the payout deadline (end + 45 days), then paid.
    const row = page.getByRole("row").filter({ has: draw });
    await expect(row).toContainText(`${email} · Email verified`);
    await expect(row).toContainText("Pay by Apr 15, 1990.");
    await submitAndWait(page, row.getByRole("button", { name: "Mark cycle 900 paid" }));
    await expect(row).toContainText("Paid on");
    await expect(row.getByRole("button", { name: "Mark cycle 900 paid" })).toHaveCount(0);
  } finally {
    await db.from("cycles").update({ winner_user_id: null }).eq("number", cycle.number);
    await db.auth.admin.deleteUser(userId);
    await db.from("cycles").delete().eq("number", cycle.number);
    await db.from("game_day_counters").delete().eq("game_date", day);
    await db.from("game_days").delete().eq("game_date", day);
  }
});

test("a signed-out visitor gets a 404", async ({ page }) => {
  for (const path of ["/admin", "/admin/settings", "/admin/flags", "/admin/draw"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("a signed-in player who is not an admin gets a 404", async ({ page, accounts }) => {
  await signUpViaForm(page, { email: accounts.uniqueEmail() });
  await expect(page).toHaveURL("/");
  for (const path of ["/admin", "/admin/settings", "/admin/flags", "/admin/draw"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("an admin opens the settings from /admin and saves them as they are", async ({ page }) => {
  await signInAsAdmin(page);
  await gotoReady(page, "/admin");
  await page.getByRole("link", { name: "Game settings" }).click();
  await expect(page).toHaveURL("/admin/settings");
  await expect(page.getByRole("textbox", { name: "Rotation" })).not.toHaveValue("");
  // Saving the values unchanged leaves the shared local settings as other tests expect them.
  await submitAndWait(page, page.getByRole("button", { name: "Save settings" }));
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
});
