import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: m.signInWithPassword, signOut: m.signOut },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { signInAction, signOutAction } from "./actions";

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.signInWithPassword.mockResolvedValue({ error: null });
  m.signOut.mockResolvedValue({ error: null });
});

describe("signInAction", () => {
  it("signs in with Supabase and redirects home", async () => {
    await expect(signInAction(null, form("player@example.com", "secret-pass"))).rejects.toThrow("NEXT_REDIRECT /");
    expect(m.signInWithPassword).toHaveBeenCalledWith({ email: "player@example.com", password: "secret-pass" });
  });

  it("returns the generic credentials message when Supabase rejects the credentials", async () => {
    m.signInWithPassword.mockResolvedValueOnce({ error: { code: "invalid_credentials" } });
    const result = await signInAction(null, form("player@example.com", "wrong-pass"));
    expect(result).toMatchObject({ ok: false, message: "Email or password is incorrect" });
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it.each(["over_request_rate_limit", "unexpected_failure", undefined])(
    "does not blame the credentials for the Supabase error %s",
    async (code) => {
      m.signInWithPassword.mockResolvedValueOnce({ error: { code } });
      const result = await signInAction(null, form("player@example.com", "secret-pass"));
      expect(result).toMatchObject({ ok: false, message: "Something went wrong. Please try again." });
    },
  );
});

describe("signOutAction", () => {
  it("clears this browser's session and returns home", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT /");
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still returns home if Supabase reports an error while signing out", async () => {
    m.signOut.mockResolvedValueOnce({ error: { message: "session not found" } });
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT /");
  });
});
