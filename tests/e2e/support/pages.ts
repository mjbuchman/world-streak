import type { Page } from "@playwright/test";
import { eligibilityToday } from "../../../src/lib/dates";

export const E2E_PASSWORD = "e2e-password-123";

/** True when the browser holds a Supabase session cookie. */
export async function hasSessionCookie(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some((cookie) => /^sb-.*-auth-token/.test(cookie.name));
}

/** A birth date whose 18th birthday is tomorrow on the eligibility date. */
export function oneDayShortOf18(): string {
  const [year, month, day] = eligibilityToday(new Date()).split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  tomorrow.setUTCFullYear(tomorrow.getUTCFullYear() - 18);
  return tomorrow.toISOString().slice(0, 10);
}

type SignUpDetails = { email: string; birthDate?: string; country?: string; password?: string };

/** Fills in and submits the sign-up form. Defaults describe an eligible adult. */
export async function signUpViaForm(page: Page, details: SignUpDetails): Promise<void> {
  const { email, birthDate = "1990-06-15", country = "US", password = E2E_PASSWORD } = details;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 8 characters)").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel("Date of birth").fill(birthDate);
  await page.getByLabel("Country of residence").selectOption(country);
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
}
