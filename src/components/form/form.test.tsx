// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CountrySelect, RulesAgreement } from "./EligibilityFields";
import { Field, TextInput } from "./Field";
import { FormAlert, SubmitButton } from "./FormParts";

afterEach(cleanup);

describe("Field", () => {
  it("labels the control and links its error, whatever the field name", () => {
    render(
      <Field name="nickname" label="Nickname" error="Too long.">
        {(control) => <TextInput {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText("Nickname");
    expect(input.id).toBe("nickname");
    expect(input.getAttribute("name")).toBe("nickname");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("nickname-error");
    expect(document.getElementById("nickname-error")?.textContent).toBe("Too long.");
  });

  it("renders no error element and no description link without an error", () => {
    render(
      <Field name="nickname" label="Nickname">
        {(control) => <TextInput {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText("Nickname");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(document.getElementById("nickname-error")).toBeNull();
  });
});

describe("RulesAgreement", () => {
  it("puts the checkbox inside its label, with no error by default", () => {
    render(<RulesAgreement />);
    const checkbox = screen.getByRole("checkbox", { name: /I agree to the official rules/ });
    expect(checkbox.closest("label")).not.toBeNull();
    expect(checkbox.getAttribute("aria-invalid")).toBe("false");
  });
});

describe("CountrySelect", () => {
  it("shows a given country in upper case", () => {
    render(<CountrySelect defaultValue="ca" />);
    expect(screen.getByLabelText<HTMLSelectElement>("Country of residence").value).toBe("CA");
  });
});

describe("FormAlert", () => {
  it("renders nothing without a message, so no empty alert is announced", () => {
    const { container } = render(<FormAlert />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a message", () => {
    render(<FormAlert message="Email or password is incorrect" />);
    expect(screen.getByRole("alert").textContent).toBe("Email or password is incorrect");
  });
});

describe("SubmitButton", () => {
  it("shows its label and is enabled when idle", () => {
    render(<SubmitButton pending={false} label="Sign in" pendingLabel="Signing in" />);
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveProperty("disabled", false);
  });

  it("shows the pending label and is disabled while submitting", () => {
    render(<SubmitButton pending label="Sign in" pendingLabel="Signing in" />);
    expect(screen.getByRole("button", { name: "Signing in" })).toHaveProperty("disabled", true);
  });
});
