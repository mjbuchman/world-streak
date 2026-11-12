import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";
import { gotoReady, oneDayShortOf18, signInViaForm, signOutViaHeader, signUpViaForm, submitAndWait } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

async function profileOf(email: string) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No auth user for ${email}`);
  const { data, error } = await adminClient().from("profiles").select("birth_date, country").eq("id", user.id);
  if (error) throw error;
  return { userId: user.id, profile: data[0] };
}

/** An account like one made by Google sign-in: an auth user with no profile yet. */
async function signedOutAccountWithoutProfile(page: Page, email: string) {
  await signUpViaForm(page, { email });
  await expect(page).toHaveURL("/");
  const { userId } = await profileOf(email);
  const { error } = await adminClient().from("profiles").delete().eq("id", userId);
  if (error) throw error;
  await signOutViaHeader(page);
}

async function submitProfile(page: Page, birthDate: string) {
  await page.getByLabel("Date of birth").fill(birthDate);
  await page.getByLabel("Country of residence").selectOption("US");
  await page.getByRole("checkbox", { name: /I agree to the official rules/ }).check();
  await submitAndWait(page, page.getByRole("button", { name: "Save and continue" }));
}

test("sign-in and sign-up offer Continue with Google", async ({ page }) => {
  for (const path of ["/signin", "/signup"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  }
});

test("Continue with Google goes to Google through local Supabase, returning to our callback", async ({ page }) => {
  // Stop at Google's door: the test checks the hand-off, never contacts Google.
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ body: "Google" }));
  await gotoReady(page, "/signin");
  const toGoogle = page.waitForRequest((request) => request.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: "Continue with Google" }).click();

  const url = new URL((await toGoogle).url());
  const redirectTo = url.searchParams.get("redirect_to") ?? "";
  expect(new URL(redirectTo).pathname).toBe("/auth/callback");
  // The client ID comes from env() in supabase/config.toml; an empty one would mean it was not read.
  expect(url.searchParams.get("client_id")).toBeTruthy();
});

test("a player without a profile is sent to complete it after signing in, and can", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signedOutAccountWithoutProfile(page, email);

  await signInViaForm(page, email);
  await expect(page).toHaveURL("/complete-profile");
  await submitProfile(page, "1991-02-03");

  await expect(page).toHaveURL("/");
  expect((await profileOf(email)).profile).toEqual({ birth_date: "1991-02-03", country: "US" });

  // With a profile, the page is no longer needed.
  await page.goto("/complete-profile");
  await expect(page).toHaveURL("/");
});

test("an underage player completing their profile is refused and gets no profile", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signedOutAccountWithoutProfile(page, email);
  await signInViaForm(page, email);
  await expect(page).toHaveURL("/complete-profile");

  await submitProfile(page, oneDayShortOf18());

  await expect(page.getByRole("alert").filter({ hasText: "open only to" })).toBeVisible();
  await expect(page).toHaveURL("/complete-profile");
  expect((await profileOf(email)).profile).toBeUndefined();
});

test("a visitor who is not signed in cannot open profile completion", async ({ page }) => {
  await page.goto("/complete-profile");
  await expect(page).toHaveURL("/signin");
});

test("a failed Google callback returns to sign-in with an explanation", async ({ page }) => {
  await page.goto("/auth/callback?error=access_denied");
  await expect(page).toHaveURL("/signin?error=oauth");
  await expect(page.getByRole("alert").filter({ hasText: "Google" })).toHaveText(
    "Google sign-in didn't complete. Please try again.",
  );
});
