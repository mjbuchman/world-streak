import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SignUpDeps, refusalMessage, signUp } from "./signup";

const TODAY = "2026-11-07";

function validForm(overrides: Record<string, string | null> = {}): FormData {
  const fields: Record<string, string | null> = {
    email: "player@example.com",
    password: "correct horse",
    birthDate: "1990-05-05",
    country: "us",
    agree: "on",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== null) form.set(key, value);
  return form;
}

function fakeDeps(): SignUpDeps & { [K in keyof Omit<SignUpDeps, "today">]: ReturnType<typeof vi.fn> } {
  return {
    today: TODAY,
    createUser: vi.fn(async () => ({ userId: "user-1" })),
    createProfile: vi.fn(async () => true),
    deleteUser: vi.fn(async () => {}),
    signIn: vi.fn(async () => true),
  };
}

let deps: ReturnType<typeof fakeDeps>;
beforeEach(() => {
  deps = fakeDeps();
});

function expectNoAccountCreated() {
  expect(deps.createUser).not.toHaveBeenCalled();
  expect(deps.createProfile).not.toHaveBeenCalled();
  expect(deps.signIn).not.toHaveBeenCalled();
}

describe("refusalMessage", () => {
  it("names the game, region and age from config", () => {
    expect(refusalMessage()).toBe("Sorry, World Streak is open only to US residents aged 18 or over.");
  });
});

describe("signUp validation", () => {
  it("rejects an invalid email without creating anything", async () => {
    const result = await signUp(validForm({ email: "not-an-email" }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: "Enter a valid email address." } });
    expectNoAccountCreated();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const result = await signUp(validForm({ password: "short12" }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: "Use at least 8 characters." } });
    expectNoAccountCreated();
  });

  it("accepts a password of exactly 8 characters", async () => {
    expect(await signUp(validForm({ password: "12345678" }), deps)).toEqual({ ok: true });
  });

  it("rejects a password longer than 72 characters, Supabase's limit", async () => {
    const result = await signUp(validForm({ password: "x".repeat(73) }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: "Use at most 72 characters." } });
    expect(await signUp(validForm({ password: "x".repeat(72) }), deps)).toEqual({ ok: true });
  });

  it.each([
    ["missing", null],
    ["blank", "  "],
  ])("asks for a country when it is %s", async (_label, country) => {
    const result = await signUp(validForm({ country }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { country: "Select your country of residence." } });
    expectNoAccountCreated();
  });

  it("requires agreeing to the official rules", async () => {
    const result = await signUp(validForm({ agree: null }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { agree: "You need to agree to the official rules." } });
    expectNoAccountCreated();
  });

  it.each([
    ["an impossible date", "1990-02-30"],
    ["a future date", "2027-01-01"],
    ["an age over 120", "1906-11-06"],
    ["a missing date", ""],
  ])("rejects %s as the date of birth", async (_label, birthDate) => {
    const result = await signUp(validForm({ birthDate }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { birthDate: "Enter a valid date of birth." } });
    expectNoAccountCreated();
  });

  it("accepts an age of exactly 120", async () => {
    expect(await signUp(validForm({ birthDate: "1906-11-07" }), deps)).toEqual({ ok: true });
  });

  it("returns the entered values (never the password) so the form can be refilled", async () => {
    const result = await signUp(validForm({ email: "bad" }), deps);
    expect(result).toMatchObject({ values: { email: "bad", birthDate: "1990-05-05", country: "us" } });
    expect(JSON.stringify(result)).not.toContain("correct horse");
  });
});

describe("signUp eligibility", () => {
  it("refuses someone one day short of 18 and creates no auth user", async () => {
    const result = await signUp(validForm({ birthDate: "2008-11-08" }), deps);
    expect(result).toMatchObject({ ok: false, message: refusalMessage() });
    expectNoAccountCreated();
  });

  it("refuses a resident of another country and creates no auth user", async () => {
    const result = await signUp(validForm({ country: "CA" }), deps);
    expect(result).toMatchObject({ ok: false, message: refusalMessage() });
    expectNoAccountCreated();
  });

  it("refuses the 'another country' option", async () => {
    const result = await signUp(validForm({ country: "ZZ" }), deps);
    expect(result).toMatchObject({ ok: false, message: refusalMessage() });
    expectNoAccountCreated();
  });
});

describe("signUp account creation", () => {
  it("creates the user and an upper-cased profile, then signs in", async () => {
    expect(await signUp(validForm(), deps)).toEqual({ ok: true });
    expect(deps.createUser).toHaveBeenCalledWith("player@example.com", "correct horse");
    expect(deps.createProfile).toHaveBeenCalledWith({ userId: "user-1", birthDate: "1990-05-05", country: "US" });
    expect(deps.signIn).toHaveBeenCalledWith("player@example.com", "correct horse");
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it("trims and lower-cases the email", async () => {
    await signUp(validForm({ email: "  Player@Example.COM " }), deps);
    expect(deps.createUser).toHaveBeenCalledWith("player@example.com", "correct horse");
  });

  it("reports an email that is already registered", async () => {
    deps.createUser.mockResolvedValueOnce({ error: "email-taken" });
    const result = await signUp(validForm(), deps);
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { email: "An account with this email already exists. Try signing in." },
    });
    expect(deps.createProfile).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure creating the user", async () => {
    deps.createUser.mockResolvedValueOnce({ error: "unknown" });
    const result = await signUp(validForm(), deps);
    expect(result).toMatchObject({ ok: false, message: "Something went wrong. Please try again." });
    expect(deps.createProfile).not.toHaveBeenCalled();
  });

  it("deletes the auth user if the profile cannot be created, so no account exists without a profile", async () => {
    deps.createProfile.mockResolvedValueOnce(false);
    const result = await signUp(validForm(), deps);
    expect(result).toMatchObject({ ok: false, message: "Something went wrong. Please try again." });
    expect(deps.deleteUser).toHaveBeenCalledWith("user-1");
    expect(deps.signIn).not.toHaveBeenCalled();
  });

  it("asks the player to sign in if the account was created but sign-in failed", async () => {
    deps.signIn.mockResolvedValueOnce(false);
    const result = await signUp(validForm(), deps);
    expect(result).toMatchObject({
      ok: false,
      message: "Your account was created, but we couldn't sign you in. Please sign in.",
    });
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
});
