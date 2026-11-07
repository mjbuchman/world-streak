import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { E2E_PASSWORD, hasSessionCookie, signUpViaForm } from "./support/pages";

const header = (page: Page) => page.getByRole("banner");
const AUTH_COOKIE = /^sb-.*-auth-token(\.\d+)?$/;

async function signOut(page: Page) {
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
}

async function submitSignIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // The form's button, not the header's "Sign in" link.
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();
}

test("sign up, sign out, then sign in again and see the email in the header", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  await expect(header(page)).toContainText(email);

  await signOut(page);
  await expect(page).toHaveURL("/");
  await expect(header(page)).not.toContainText(email);
  expect(await hasSessionCookie(page)).toBe(false);

  await header(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/signin");
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

  // The session cookie holds base64url JSON, possibly split into numbered chunks. Mark the
  // access token as expired so the next request must refresh it with the refresh token.
  const context = page.context();
  const chunks = (await context.cookies())
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const stored = chunks.map((cookie) => cookie.value).join("");
  const session = JSON.parse(Buffer.from(stored.replace(/^base64-/, ""), "base64url").toString("utf8"));
  const oldAccessToken: string = session.access_token;
  session.expires_at = Math.floor(Date.now() / 1000) - 60;

  const baseName = chunks[0].name.replace(/\.\d+$/, "");
  await context.clearCookies({ name: AUTH_COOKIE });
  await context.addCookies([
    {
      ...chunks[0],
      name: baseName,
      value: `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`,
    },
  ]);

  const response = await page.goto("/");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(header(page)).toContainText(email);

  const refreshed = (await context.cookies())
    .filter((cookie) => AUTH_COOKIE.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((cookie) => cookie.value)
    .join("");
  const newSession = JSON.parse(Buffer.from(refreshed.replace(/^base64-/, ""), "base64url").toString("utf8"));
  expect(newSession.access_token).not.toBe(oldAccessToken);
  expect(newSession.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
});
