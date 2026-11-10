import { expect, test } from "./support/fixtures";
import { hasSessionCookie, oneDayShortOf18, signUpViaForm } from "./support/pages";
import { adminClient, findUserByEmail } from "./support/supabase";

test("the rules checkbox links to the official rules page", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: "official rules" })).toHaveAttribute("href", "/rules");
});

test("a field error is shown next to the field and the form keeps what was typed", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email, password: "short" });

  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Password (at least 8 characters)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Date of birth")).toHaveValue("1990-06-15");
  await expect(page.getByLabel("Country of residence")).toHaveValue("US");
  // The passwords survive the server's reply too (React resets uncontrolled fields after an action).
  await expect(page.getByLabel("Password (at least 8 characters)")).toHaveValue("short");
  await expect(page.getByLabel("Confirm password")).toHaveValue("short");
});

test("a mismatched confirmation is caught before anything is sent", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  let posted = false;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/signup")) posted = true;
  });
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 8 characters)").fill("e2e-password-123");
  await page.getByLabel("Confirm password").fill("e2e-password-124");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("The passwords don't match.")).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeFocused();
  expect(posted).toBe(false);
  expect(await findUserByEmail(email)).toBeUndefined();
});

test("an eligible adult signs up, gets a profile and lands on the home page signed in", async ({
  page,
  accounts,
}) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email, birthDate: "1990-06-15" });
  await expect(page).toHaveURL("/");
  expect(await hasSessionCookie(page)).toBe(true);

  const user = await findUserByEmail(email);
  expect(user).toBeDefined();
  if (!user) return;
  const { data: profile } = await adminClient()
    .from("profiles")
    .select("birth_date, country")
    .eq("id", user.id)
    .single();
  expect(profile).toEqual({ birth_date: "1990-06-15", country: "US" });
});

test("someone one day short of 18 is refused and no account is created", async ({ page, accounts }) => {
  const email = accounts.uniqueEmail();
  await signUpViaForm(page, { email, birthDate: oneDayShortOf18() });
  // Next.js renders its own empty role="alert" route announcer, so pick ours by content.
  await expect(page.getByRole("alert").filter({ hasText: "Sorry" })).toHaveText(
    "Sorry, World Streak is open only to US residents aged 18 or over.",
  );
  await expect(page).toHaveURL("/signup");
  expect(await hasSessionCookie(page)).toBe(false);
  expect(await findUserByEmail(email)).toBeUndefined();
});
