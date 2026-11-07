import { expect, test } from "./support/fixtures";
import { E2E_PASSWORD, hasSessionCookie, signUpViaForm } from "./support/pages";

const header = (page: import("@playwright/test").Page) => page.getByRole("banner");

test("sign up, sign out, then sign in again and see the email in the header", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  await expect(header(page)).toContainText(email);

  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(header(page)).not.toContainText(email);
  expect(await hasSessionCookie(page)).toBe(false);

  await header(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(header(page)).toContainText(email);
  await expect(header(page).getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("a wrong password shows a message that does not say which part was wrong", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email });
  await header(page).getByRole("button", { name: "Sign out" }).click();
  await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  // The main form's button, not the header link.
  await page.getByRole("main").getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toHaveText("Email or password is incorrect");
  await expect(page).toHaveURL("/signin");
  expect(await hasSessionCookie(page)).toBe(false);
});

test("the header offers sign-in to visitors on every page", async ({ page }) => {
  for (const path of ["/", "/signup", "/rules"]) {
    await page.goto(path);
    await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  }
});
