import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { eligibilityToday } from "../../src/lib/dates";

// Service-role client for checking what the sign-up actually wrote. The keys come from the
// environment (exported from `supabase status`, as in CI); this only ever runs locally.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Export the local Supabase keys before running e2e tests (see README).");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function findUserByEmail(email: string) {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient().auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email === email);
    if (match || data.users.length < perPage) return match;
  }
}

const createdEmails: string[] = [];

function uniqueEmail(): string {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  createdEmails.push(email);
  return email;
}

// Remove the accounts these tests create so the local database does not fill up.
test.afterAll(async () => {
  for (const email of createdEmails) {
    const user = await findUserByEmail(email);
    if (user) await adminClient().auth.admin.deleteUser(user.id);
  }
});

// A birth date whose 18th birthday is tomorrow on the eligibility date.
function oneDayShortOf18(): string {
  const [year, month, day] = eligibilityToday(new Date()).split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  tomorrow.setUTCFullYear(tomorrow.getUTCFullYear() - 18);
  return tomorrow.toISOString().slice(0, 10);
}

async function fillSignUp(page: Page, email: string, birthDate: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 8 characters)").fill("e2e-password-123");
  await page.getByLabel("Date of birth").fill(birthDate);
  await page.getByLabel("Country of residence").selectOption("US");
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
}

async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => /^sb-.*-auth-token/.test(cookie.name));
}

test("the rules checkbox links to the official rules page", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: "official rules" })).toHaveAttribute("href", "/rules");
});

test("a field error is shown next to the field and the form keeps what was typed", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 8 characters)").fill("short");
  await page.getByLabel("Date of birth").fill("1990-06-15");
  await page.getByLabel("Country of residence").selectOption("US");
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Password (at least 8 characters)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Date of birth")).toHaveValue("1990-06-15");
  await expect(page.getByLabel("Country of residence")).toHaveValue("US");
});

test("an eligible adult signs up, gets a profile and lands on the home page signed in", async ({ page }) => {
  const email = uniqueEmail();
  await fillSignUp(page, email, "1990-06-15");
  await expect(page).toHaveURL("/");
  expect(await hasSessionCookie(page)).toBe(true);

  const user = await findUserByEmail(email);
  expect(user).toBeDefined();
  const { data: profile } = await adminClient()
    .from("profiles")
    .select("birth_date, country")
    .eq("id", user!.id)
    .single();
  expect(profile).toEqual({ birth_date: "1990-06-15", country: "US" });
});

test("someone one day short of 18 is refused and no account is created", async ({ page }) => {
  const email = uniqueEmail();
  await fillSignUp(page, email, oneDayShortOf18());
  // Next.js renders its own empty role="alert" route announcer, so pick ours by content.
  await expect(page.getByRole("alert").filter({ hasText: "Sorry" })).toHaveText(
    "Sorry, World Streak is open only to US residents aged 18 or over.",
  );
  await expect(page).toHaveURL("/signup");
  expect(await hasSessionCookie(page)).toBe(false);
  expect(await findUserByEmail(email)).toBeUndefined();
});
