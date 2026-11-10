// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompleteProfileState } from "@/lib/profileCompletion";

const completeProfileAction = vi.hoisted(() =>
  vi.fn<(previous: CompleteProfileState | null, form: FormData) => Promise<CompleteProfileState>>(),
);
vi.mock("./actions", () => ({ completeProfileAction }));

import { CompleteProfileForm } from "./CompleteProfileForm";

afterEach(() => {
  cleanup();
  completeProfileAction.mockReset();
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  render(<CompleteProfileForm />);
  await user.type(screen.getByLabelText("Date of birth"), "1990-05-05");
  await user.selectOptions(screen.getByLabelText("Country of residence"), "US");
  await user.click(screen.getByRole("checkbox", { name: /I agree to the official rules/ }));
  await user.click(screen.getByRole("button", { name: "Save and continue" }));
}

describe("CompleteProfileForm", () => {
  it("sends the date of birth, country and agreement to the action", async () => {
    completeProfileAction.mockResolvedValue({ ok: false, values: { birthDate: "1990-05-05", country: "US" } });
    await fillAndSubmit();
    await vi.waitFor(() => expect(completeProfileAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(completeProfileAction.mock.calls[0][1])).toEqual({
      birthDate: "1990-05-05",
      country: "US",
      agree: "on",
    });
  });

  it("shows the refusal message and keeps what was entered", async () => {
    completeProfileAction.mockResolvedValue({
      ok: false,
      message: "Sorry, World Streak is open only to US residents aged 18 or over.",
      values: { birthDate: "1990-05-05", country: "US" },
    });
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toContain("open only to US residents");
    expect(screen.getByLabelText<HTMLInputElement>("Date of birth").value).toBe("1990-05-05");
    expect(screen.getByLabelText<HTMLSelectElement>("Country of residence").value).toBe("US");
  });

  it("shows field errors next to the fields", async () => {
    completeProfileAction.mockResolvedValue({
      ok: false,
      fieldErrors: { agree: "You need to agree to the official rules." },
      values: { birthDate: "1990-05-05", country: "US" },
    });
    await fillAndSubmit();
    expect(await screen.findByText("You need to agree to the official rules.")).toBeTruthy();
  });

  it("shows the button as busy, keeping its name, while saving", async () => {
    completeProfileAction.mockReturnValue(new Promise(() => {}));
    await fillAndSubmit();
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Save and continue" }).getAttribute("aria-busy")).toBe("true"),
    );
  });
});
