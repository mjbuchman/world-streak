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

  it("returns the generic message when Supabase rejects the credentials", async () => {
    m.signInWithPassword.mockResolvedValueOnce({ error: { code: "invalid_credentials" } });
    const result = await signInAction(null, form("player@example.com", "wrong-pass"));
    expect(result).toMatchObject({ ok: false, message: "Email or password is incorrect" });
    expect(m.redirect).not.toHaveBeenCalled();
  });
});

describe("signOutAction", () => {
  it("clears the session and returns home", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT /");
    expect(m.signOut).toHaveBeenCalledTimes(1);
  });
});
