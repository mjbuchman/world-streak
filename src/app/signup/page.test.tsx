import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The eligibility constants are read when modules load, so each case mocks the config and
// reloads the modules that read it. The client form pulls in server actions and is not under
// test here.
vi.mock("@/app/signup/SignUpForm", () => ({ SignUpForm: () => null }));
vi.mock("@/components/GoogleSignInButton", () => ({ GoogleSignInButton: () => null }));

afterEach(() => {
  vi.doUnmock("@/config/eligibility");
  vi.resetModules();
});

async function loadWith(allowedCountries: string[], minAge: number) {
  vi.resetModules();
  vi.doMock("@/config/eligibility", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/config/eligibility")>()),
    ALLOWED_COUNTRIES: allowedCountries,
    MIN_AGE: minAge,
  }));
  const { eligibilitySummary } = await import("@/lib/eligibility");
  const { refusalMessage } = await import("@/lib/eligibility");
  const { default: SignUpPage } = await import("@/app/signup/page");
  return { eligibilitySummary, refusalMessage, pageText: renderToStaticMarkup(SignUpPage()) };
}

describe("eligibility wording", () => {
  it("describes the current rules", async () => {
    const { eligibilitySummary, refusalMessage, pageText } = await loadWith(["US"], 18);
    expect(eligibilitySummary()).toBe("US residents aged 18 or over");
    expect(refusalMessage()).toBe("Sorry, World Streak is open only to US residents aged 18 or over.");
    expect(pageText).toContain("Open to US residents aged 18 or over.");
  });

  it("follows the config in both the refusal message and the sign-up page", async () => {
    const { refusalMessage, pageText } = await loadWith(["US", "CA"], 21);
    expect(refusalMessage()).toBe("Sorry, World Streak is open only to US or CA residents aged 21 or over.");
    expect(pageText).toContain("Open to US or CA residents aged 21 or over.");
  });
});
