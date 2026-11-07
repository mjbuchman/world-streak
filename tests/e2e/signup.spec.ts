import { expect, test, type Page } from "@playwright/test";
import { eligibilityToday } from "../../src/lib/dates";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// The latest birth date that is still one day short of 18 on the eligibility date.
function oneDayShortOf18(): string {
  const [year, month, day] = eligibilityToday(new Date()).split("-").map(Number);
  return new Date(Date.UTC(year - 18, month - 1, day + 1)).toISOString().slice(0, 10);
}

async function fillSignUp(page: Page, birthDate: string) {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password (at least 8 characters)").fill("e2e-password-123");
  await page.getByLabel("Date of birth").fill(birthDate);
  await page.getByLabel("Country of residence").selectOption("US");
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
}

test("an eligible adult signs up and lands on the home page signed in", async ({ page, context }) => {
  await fillSignUp(page, "1990-06-15");
  await expect(page).toHaveURL("/");
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => /^sb-.*-auth-token/.test(cookie.name))).toBe(true);
});

test("someone one day short of 18 is refused and stays on the sign-up page", async ({ page, context }) => {
  await fillSignUp(page, oneDayShortOf18());
  // Next.js renders its own empty role="alert" route announcer, so pick ours by content.
  await expect(page.getByRole("alert").filter({ hasText: "Sorry" })).toHaveText(
    "Sorry, World Streak is open only to US residents aged 18 or over.",
  );
  await expect(page).toHaveURL("/signup");
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => /^sb-.*-auth-token/.test(cookie.name))).toBe(false);
});
