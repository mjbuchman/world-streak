import type { Locator, Page } from "@playwright/test";
import { eligibilityToday } from "../../../src/lib/dates";

export const E2E_PASSWORD = "e2e-password-123";

/**
 * Opens `path` and waits until React has hydrated it (HydrationMarker), so typed values are not
 * wiped and clicks are not lost while a cold dev server is still compiling (T78).
 */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

/**
 * Clicks a form's submit button and waits for its server action to answer (Next.js marks every
 * server action request with a `Next-Action` header). Under parallel load the dev server can take
 * longer than an assertion's few seconds to answer; waiting on the real reply, not a guess, keeps
 * the checks after it short (T78).
 */
export async function submitAndWait(page: Page, button: Locator): Promise<void> {
  const reply = page.waitForResponse((response) => response.request().headers()["next-action"] !== undefined);
  await button.click();
  await reply;
}

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
  await gotoReady(page, "/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 8 characters)").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel("Date of birth").fill(birthDate);
  await page.getByLabel("Country of residence").selectOption(country);
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await submitAndWait(page, page.getByRole("button", { name: "Create account" }));
}
