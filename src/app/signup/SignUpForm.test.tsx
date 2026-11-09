// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignUpState } from "@/lib/signup";

const signUpAction = vi.hoisted(() => vi.fn<(previous: SignUpState | null, form: FormData) => Promise<SignUpState>>());
vi.mock("./actions", () => ({ signUpAction }));

import { SignUpForm } from "./SignUpForm";

afterEach(() => {
  cleanup();
  signUpAction.mockReset();
});

const values = { email: "player@example.com", birthDate: "1990-06-15", country: "US" };

async function fillAndSubmit() {
  const user = userEvent.setup();
  render(<SignUpForm />);
  await user.type(screen.getByLabelText("Email"), values.email);
  await user.type(screen.getByLabelText("Password (at least 8 characters)"), "secret-password");
  await user.type(screen.getByLabelText("Date of birth"), values.birthDate);
  await user.selectOptions(screen.getByLabelText("Country of residence"), "US");
  await user.click(screen.getByRole("checkbox", { name: /I agree to the official rules/ }));
  await user.click(screen.getByRole("button", { name: "Create account" }));
  return user;
}

describe("SignUpForm", () => {
  it("starts with no country selected and links the rules", () => {
    render(<SignUpForm />);
    expect(screen.getByLabelText<HTMLSelectElement>("Country of residence").value).toBe("");
    expect(screen.getByRole("link", { name: "official rules" }).getAttribute("href")).toBe("/rules");
  });

  it("sends the entered values to the server action", async () => {
    signUpAction.mockResolvedValue({ ok: false, values });
    await fillAndSubmit();
    // React 19 runs form actions in a transition, so wait for the call rather than assume it.
    await vi.waitFor(() => expect(signUpAction).toHaveBeenCalledTimes(1));
    const form = signUpAction.mock.calls[0][1];
    expect(Object.fromEntries(form)).toEqual({
      email: values.email,
      password: "secret-password",
      birthDate: values.birthDate,
      country: "US",
      agree: "on",
    });
  });

  it("shows each field error next to its field, linked for screen readers", async () => {
    signUpAction.mockResolvedValue({
      ok: false,
      values,
      fieldErrors: {
        email: "Enter a valid email address.",
        password: "Use at least 8 characters.",
        birthDate: "Enter a valid date of birth.",
        country: "Select your country of residence.",
        agree: "You need to agree to the official rules.",
      },
    });
    await fillAndSubmit();
    // The action result renders in a transition, so wait for it (this raced under load).
    await screen.findByText("Enter a valid email address.");

    const cases: [HTMLElement, string][] = [
      [screen.getByLabelText("Email"), "Enter a valid email address."],
      [screen.getByLabelText("Password (at least 8 characters)"), "Use at least 8 characters."],
      [screen.getByLabelText("Date of birth"), "Enter a valid date of birth."],
      [screen.getByLabelText("Country of residence"), "Select your country of residence."],
      [screen.getByRole("checkbox"), "You need to agree to the official rules."],
    ];
    for (const [control, message] of cases) {
      expect(control.getAttribute("aria-invalid")).toBe("true");
      const describedBy = control.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent).toBe(message);
    }
  });

  it("marks nothing invalid when there are no field errors", () => {
    render(<SignUpForm />);
    for (const control of [screen.getByLabelText("Email"), screen.getByRole("checkbox")]) {
      expect(control.getAttribute("aria-invalid")).toBe("false");
      expect(control.getAttribute("aria-describedby")).toBeNull();
    }
  });

  it("shows a form-level message as an alert", async () => {
    signUpAction.mockResolvedValue({ ok: false, values, message: "Sorry, not eligible." });
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toBe("Sorry, not eligible.");
  });

  it("refills the email, birth date and country from the server's reply, but never the password", async () => {
    // Different from what was typed, so the refill provably comes from the returned state,
    // and the lower-case country exercises the select's normalising remount.
    const returned = { email: "server@example.com", birthDate: "1985-01-02", country: "us" };
    signUpAction.mockResolvedValue({ ok: false, values: returned, fieldErrors: { email: "taken" } });
    await fillAndSubmit();
    await screen.findByText("taken");
    expect(screen.getByLabelText<HTMLInputElement>("Email").value).toBe(returned.email);
    expect(screen.getByLabelText<HTMLInputElement>("Date of birth").value).toBe(returned.birthDate);
    expect(screen.getByLabelText<HTMLSelectElement>("Country of residence").value).toBe("US");
    expect(screen.getByLabelText<HTMLInputElement>("Password (at least 8 characters)").value).toBe("");
  });

  it("disables the button and says it is working while the action runs", async () => {
    let finish!: (state: SignUpState) => void;
    signUpAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await fillAndSubmit();

    const button = await screen.findByRole("button", { name: "Creating account" });
    expect(button).toHaveProperty("disabled", true);

    finish({ ok: false, values });
    expect(await screen.findByRole("button", { name: "Create account" })).toHaveProperty("disabled", false);
  });
});
