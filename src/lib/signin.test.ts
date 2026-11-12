import { describe, expect, it, vi } from "vitest";
import { EMAIL_NOT_CONFIRMED, SIGN_IN_FAILED, WRONG_CREDENTIALS, type SignInDeps, signIn } from "./signin";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const answering = (outcome: Awaited<ReturnType<SignInDeps["authenticate"]>>) => ({
  authenticate: vi.fn(async () => outcome),
});

describe("signIn", () => {
  it("signs in with a trimmed, lower-cased email", async () => {
    const deps = answering("ok");
    const result = await signIn(form({ email: "  Player@Example.COM ", password: "secret-pass" }), deps);
    expect(result).toEqual({ ok: true });
    expect(deps.authenticate).toHaveBeenCalledWith("player@example.com", "secret-pass");
  });

  it("shows one message for wrong credentials, without saying which part was wrong", async () => {
    const result = await signIn(form({ email: "player@example.com", password: "wrong-pass" }), answering("invalid-credentials"));
    expect(result).toEqual({ ok: false, message: WRONG_CREDENTIALS, values: { email: "player@example.com" } });
    expect(WRONG_CREDENTIALS).toBe("Email or password is incorrect");
  });

  it("does not blame the password when sign-in fails for another reason", async () => {
    const result = await signIn(form({ email: "player@example.com", password: "secret-pass" }), answering("error"));
    expect(result).toEqual({ ok: false, message: SIGN_IN_FAILED, values: { email: "player@example.com" } });
    expect(SIGN_IN_FAILED).not.toMatch(/password|email/i);
  });

  it("asks for a valid email before trying to sign in", async () => {
    const deps = answering("ok");
    const result = await signIn(form({ email: "nope", password: "secret-pass" }), deps);
    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
      values: { email: "nope" },
    });
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("asks for an email when the field is missing", async () => {
    const deps = answering("ok");
    const result = await signIn(form({ password: "secret-pass" }), deps);
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) }, values: { email: "" } });
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("asks for a password before trying to sign in", async () => {
    const deps = answering("ok");
    const result = await signIn(form({ email: "player@example.com" }), deps);
    expect(result).toEqual({
      ok: false,
      fieldErrors: { password: "Enter your password." },
      values: { email: "player@example.com" },
    });
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("says when the email is not confirmed yet, in case confirmation is ever turned on", async () => {
    const result = await signIn(form({ email: "player@example.com", password: "right-pass" }), answering("email-not-confirmed"));
    expect(result).toEqual({ ok: false, message: EMAIL_NOT_CONFIRMED, values: { email: "player@example.com" } });
    expect(EMAIL_NOT_CONFIRMED).toBe("Confirm your email first: open the link we sent you, then sign in.");
  });

  it("never echoes the password back", async () => {
    const result = await signIn(
      form({ email: "player@example.com", password: "hunter22-secret" }),
      answering("invalid-credentials"),
    );
    expect(JSON.stringify(result)).not.toContain("hunter22-secret");
  });
});
