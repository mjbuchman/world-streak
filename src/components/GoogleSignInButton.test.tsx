// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }) }));

import { GoogleSignInButton } from "./GoogleSignInButton";

beforeEach(() => {
  // On success Supabase navigates the browser to Google, so the promise never matters.
  signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/" }, error: null });
});

afterEach(() => {
  cleanup();
  signInWithOAuth.mockReset();
});

async function clickContinue() {
  const user = userEvent.setup();
  render(<GoogleSignInButton />);
  await user.click(screen.getByRole("button", { name: "Continue with Google" }));
}

describe("GoogleSignInButton", () => {
  it("starts Google sign-in and asks to come back to this site's callback", async () => {
    await clickContinue();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });

  it("is a plain button, so it never submits the email form around it", () => {
    render(<GoogleSignInButton />);
    expect(screen.getByRole("button", { name: "Continue with Google" }).getAttribute("type")).toBe("button");
  });

  it("disables itself while Google sign-in starts, so it cannot be started twice", async () => {
    signInWithOAuth.mockReturnValue(new Promise(() => {}));
    await clickContinue();
    expect(screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows an error and lets the player try again when Google sign-in cannot start", async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "provider disabled" } });
    await clickContinue();
    expect((await screen.findByRole("alert")).textContent).toBe("Google sign-in didn't start. Please try again.");
    expect(screen.getByRole("button", { name: "Continue with Google" }).hasAttribute("disabled")).toBe(false);
  });
});
