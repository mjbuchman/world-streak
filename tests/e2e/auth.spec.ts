import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { E2E_PASSWORD, gotoReady, hasSessionCookie, signUpViaForm, submitAndWait } from "./support/pages";
import { readSession, writeSession } from "./support/session";

const header = (page: Page) => page.getByRole("banner");

async function signOut(page: Page) {
  await submitAndWait(page, header(page).getByRole("button", { name: "Sign out" }));
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
}

async function submitSignIn(page: Page, email: string, password: string) {
  await gotoReady(page, "/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // The form's button, not the header's "Sign in" link.
  await submitAndWait(page, page.getByRole("main").getByRole("button", { name: "Sign in" }));
}

test("sign up, sign out, then sign in again and see the email in the header", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  await expect(header(page)).toContainText(email);

  // Sign out from another page, so the redirect home is really exercised.
  await gotoReady(page, "/rules");
  await expect(header(page)).toContainText(email);
  await signOut(page);
  await expect(page).toHaveURL("/");
  await expect(header(page)).not.toContainText(email);
  expect(await hasSessionCookie(page)).toBe(false);

  // The header re-renders as the sign-out settles, which can swallow a click on the fresh link
  // under load: click again until it navigates.
  await expect(async () => {
    await header(page).getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/signin", { timeout: 2000 });
  }).toPass();
  await submitSignIn(page, email, E2E_PASSWORD);

  await expect(page).toHaveURL("/");
  await expect(header(page)).toContainText(email);
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("a wrong password and an unknown email get the same message", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await signOut(page);

  const message = page.getByRole("alert").filter({ hasText: "incorrect" });
  await submitSignIn(page, email, "not-the-password");
  await expect(message).toHaveText("Email or password is incorrect");
  await expect(page).toHaveURL("/signin");
  expect(await hasSessionCookie(page)).toBe(false);

  await submitSignIn(page, accounts.uniqueEmail(), "not-the-password");
  await expect(message).toHaveText("Email or password is incorrect");
  expect(await hasSessionCookie(page)).toBe(false);
});

test("the header offers sign-in to visitors on every page", async ({ page }) => {
  for (const path of ["/", "/signup", "/rules"]) {
    await page.goto(path);
    await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  }
});

test("an expired access token is refreshed on the next page load, without signing out", async ({
  page,
  accounts,
}) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(header(page)).toContainText(email);

  // Mark the access token as expired so the next request must use the refresh token.
  const context = page.context();
  const before = await readSession(context);
  await writeSession(context, { ...before, expires_at: Math.floor(Date.now() / 1000) - 60 });

  const response = await page.goto("/");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(header(page)).toContainText(email);

  const after = await readSession(context);
  expect(after.access_token).not.toBe(before.access_token);
  expect(after.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
});
