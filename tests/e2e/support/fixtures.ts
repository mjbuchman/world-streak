import { test as base } from "@playwright/test";
import { deleteUsersByEmail } from "./supabase";

type Accounts = {
  /** A fresh email address; any account created with it is deleted after the test. */
  uniqueEmail(): string;
};

/**
 * Playwright `test` with an `accounts` fixture. Its teardown runs after every test, including
 * failed ones, so test accounts never pile up in the local database.
 */
export const test = base.extend<{ accounts: Accounts }>({
  // The second parameter is Playwright's "use"; named "provide" so the React hooks lint rule
  // does not mistake it for a React hook.
  accounts: async ({}, provide) => {
    const emails: string[] = [];
    await provide({
      uniqueEmail() {
        const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
        emails.push(email);
        return email;
      },
    });
    await deleteUsersByEmail(emails);
  },
});

export { expect } from "@playwright/test";
