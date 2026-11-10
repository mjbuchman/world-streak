// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignInState } from "@/lib/signin";

const signInAction = vi.hoisted(() => vi.fn<(previous: SignInState | null, form: FormData) => Promise<SignInState>>());
vi.mock("@/app/auth/actions", () => ({ signInAction }));

import { SignInForm } from "./SignInForm";

afterEach(() => {
  cleanup();
  signInAction.mockReset();
});

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  render(<SignInForm />);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("sends the email and password to the action", async () => {
    signInAction.mockResolvedValue({ ok: false, values: { email: "a@example.com" } });
    await submit("a@example.com", "secret-pass");
    await vi.waitFor(() => expect(signInAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(signInAction.mock.calls[0][1])).toEqual({
      email: "a@example.com",
      password: "secret-pass",
    });
  });

  it("shows the wrong-credentials message and keeps the email", async () => {
    signInAction.mockResolvedValue({
      ok: false,
      message: "Email or password is incorrect",
      values: { email: "a@example.com" },
    });
    await submit("a@example.com", "wrong-pass");
    expect((await screen.findByRole("alert")).textContent).toBe("Email or password is incorrect");
    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe("a@example.com");
    expect(screen.getByLabelText<HTMLInputElement>("Password").value).toBe("");
  });

  it("shows field errors next to their fields", async () => {
    signInAction.mockResolvedValue({
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
      values: { email: "nope" },
    });
    await submit("nope", "x");
    const email = await screen.findByLabelText("Email");
    await vi.waitFor(() => expect(email.getAttribute("aria-invalid")).toBe("true"));
    expect(document.getElementById(email.getAttribute("aria-describedby")!)?.textContent).toBe(
      "Enter a valid email address.",
    );
  });

  it("shows the button as busy while signing in", async () => {
    signInAction.mockReturnValue(new Promise(() => {}));
    await submit("a@example.com", "secret-pass");
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" }).getAttribute("aria-busy")).toBe("true"),
    );
  });
});
