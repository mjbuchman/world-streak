import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The client components pull in Supabase and server actions and are tested on their own.
vi.mock("@/app/signin/SignInForm", () => ({ SignInForm: () => null }));
vi.mock("@/components/GoogleSignInButton", () => ({ GoogleSignInButton: () => <button>Continue with Google</button> }));

import SignInPage from "./page";

async function render(searchParams: Record<string, string>) {
  return renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("SignInPage", () => {
  it("offers Google sign-in", async () => {
    expect(await render({})).toContain("Continue with Google");
  });

  it("explains that Google sign-in did not complete when the callback failed", async () => {
    expect(await render({ error: "oauth" })).toContain("Google sign-in didn&#x27;t complete. Please try again.");
  });

  it("shows no error on a normal visit or for an unknown error value", async () => {
    expect(await render({})).not.toContain('role="alert"');
    expect(await render({ error: "something-else" })).not.toContain('role="alert"');
  });
});
