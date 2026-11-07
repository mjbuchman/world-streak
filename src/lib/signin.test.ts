import { describe, expect, it, vi } from "vitest";
import { WRONG_CREDENTIALS, signIn } from "./signin";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("signIn", () => {
  it("signs in with a trimmed, lower-cased email", async () => {
    const authenticate = vi.fn(async () => true);
    const result = await signIn(form({ email: "  Player@Example.COM ", password: "secret-pass" }), { authenticate });
    expect(result).toEqual({ ok: true });
    expect(authenticate).toHaveBeenCalledWith("player@example.com", "secret-pass");
  });

  it("shows one message for wrong credentials, without saying which part was wrong", async () => {
    const result = await signIn(form({ email: "player@example.com", password: "wrong-pass" }), {
      authenticate: async () => false,
    });
    expect(result).toEqual({ ok: false, message: WRONG_CREDENTIALS, values: { email: "player@example.com" } });
    expect(WRONG_CREDENTIALS).toBe("Email or password is incorrect");
  });

  it("asks for a valid email before trying to sign in", async () => {
    const authenticate = vi.fn(async () => true);
    const result = await signIn(form({ email: "nope", password: "secret-pass" }), { authenticate });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: "Enter a valid email address." },
      values: { email: "nope" },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("asks for a password before trying to sign in", async () => {
    const authenticate = vi.fn(async () => true);
    const result = await signIn(form({ email: "player@example.com" }), { authenticate });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { password: "Enter your password." },
      values: { email: "player@example.com" },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("never echoes the password back", async () => {
    const result = await signIn(form({ email: "player@example.com", password: "hunter22-secret" }), {
      authenticate: async () => false,
    });
    expect(JSON.stringify(result)).not.toContain("hunter22-secret");
  });
});
