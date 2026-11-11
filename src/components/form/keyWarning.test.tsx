// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The forms' server actions are never called here; stub them so the modules load without a server.
vi.mock("@/app/auth/actions", () => ({ signInAction: vi.fn() }));
vi.mock("@/app/signup/actions", () => ({ signUpAction: vi.fn() }));
vi.mock("@/app/complete-profile/actions", () => ({ completeProfileAction: vi.fn() }));

import { CompleteProfileForm } from "@/app/complete-profile/CompleteProfileForm";
import { SignInForm } from "@/app/signin/SignInForm";
import { SignUpForm } from "@/app/signup/SignUpForm";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const forms: [string, () => ReactElement][] = [
  ["/signin", () => <SignInForm />],
  ["/signup", () => <SignUpForm />],
  ["/complete-profile", () => <CompleteProfileForm />],
];

/** Every console.error call React made while rendering, as one string per call. */
function reactErrors(renderForm: () => void): string[] {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  renderForm();
  return spy.mock.calls.map((args) => args.map(String).join(" "));
}

describe.each(forms)("the %s form", (_page, form) => {
  it("server-renders with no React warnings", () => {
    expect(reactErrors(() => renderToString(form()))).toEqual([]);
  });

  it("renders in the browser with no React warnings", () => {
    expect(reactErrors(() => render(form()))).toEqual([]);
  });
});
