import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
  signInWithPassword: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

const createAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: createAdmin }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: m.signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { signUpAction } from "./actions";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields = {
    email: "player@example.com",
    password: "correct horse",
    confirmPassword: "correct horse",
    birthDate: "1990-05-05",
    country: "US",
    agree: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

afterEach(() => vi.useRealTimers());

beforeEach(() => {
  vi.clearAllMocks();
  // A fixed clock far from any birthday used below, so no test depends on the real date.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-15T18:00:00Z"));
  createAdmin.mockReturnValue({
    auth: { admin: { createUser: m.createUser, deleteUser: m.deleteUser } },
    from: m.from,
  });
  m.createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  m.from.mockReturnValue({ insert: m.insert });
  m.insert.mockResolvedValue({ error: null });
  m.signInWithPassword.mockResolvedValue({ error: null });
  m.deleteUser.mockResolvedValue({ error: null });
});

describe("signUpAction", () => {
  it("creates a confirmed user and profile, signs in and redirects home", async () => {
    await expect(signUpAction(null, form())).rejects.toThrow("NEXT_REDIRECT /");
    expect(m.createUser).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "correct horse",
      email_confirm: true,
    });
    expect(m.from).toHaveBeenCalledWith("profiles");
    expect(m.insert).toHaveBeenCalledWith({ id: "user-1", birth_date: "1990-05-05", country: "US" });
    expect(m.signInWithPassword).toHaveBeenCalledWith({ email: "player@example.com", password: "correct horse" });
  });

  it("maps Supabase's email_exists error to the email-taken message", async () => {
    m.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "email_exists" } });
    const result = await signUpAction(null, form());
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.stringContaining("already exists") } });
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("treats other user-creation errors as unexpected", async () => {
    m.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "unexpected_failure" } });
    expect(await signUpAction(null, form())).toMatchObject({ ok: false, message: expect.stringContaining("went wrong") });
  });

  it("deletes the auth user when the profile insert fails", async () => {
    m.insert.mockResolvedValueOnce({ error: { message: "insert failed" } });
    const result = await signUpAction(null, form());
    expect(result).toMatchObject({ ok: false });
    expect(m.deleteUser).toHaveBeenCalledWith("user-1");
    expect(m.signInWithPassword).not.toHaveBeenCalled();
  });

  it("treats a profile that already exists as a failure for a brand-new account, and deletes the user", async () => {
    m.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    const result = await signUpAction(null, form());
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("went wrong") });
    expect(m.deleteUser).toHaveBeenCalledWith("user-1");
    expect(m.signInWithPassword).not.toHaveBeenCalled();
  });

  it("reports a failed sign-in without deleting the new account", async () => {
    m.signInWithPassword.mockResolvedValueOnce({ error: { message: "invalid" } });
    const result = await signUpAction(null, form());
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("Please sign in") });
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  describe("uses the Hawaii date for the age check, not UTC", () => {
    it("refuses an 18th birthday that has started in UTC but not yet in Hawaii", async () => {
      vi.setSystemTime(new Date("2026-11-08T06:00:00Z")); // still Nov 7 in Honolulu
      const result = await signUpAction(null, form({ birthDate: "2008-11-08" }));
      expect(result).toMatchObject({ ok: false, message: expect.stringContaining("aged 18 or over") });
      expect(m.createUser).not.toHaveBeenCalled();
    });

    it("accepts the same birthday once it is Nov 8 in Hawaii", async () => {
      vi.setSystemTime(new Date("2026-11-08T10:00:00Z")); // midnight in Honolulu
      await expect(signUpAction(null, form({ birthDate: "2008-11-08" }))).rejects.toThrow("NEXT_REDIRECT /");
      expect(m.createUser).toHaveBeenCalled();
    });
  });

  it("does not create the admin client for a submission that fails validation", async () => {
    const result = await signUpAction(null, form({ email: "nope" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: expect.any(String) } });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation without touching Supabase", async () => {
    const result = await signUpAction(null, form({ confirmPassword: "correct horses" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { confirmPassword: "The passwords don't match." } });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("rejects a short password without touching Supabase", async () => {
    const result = await signUpAction(null, form({ password: "short", confirmPassword: "short" }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { password: expect.any(String) } });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("refuses a non-US resident without touching Supabase", async () => {
    const result = await signUpAction(null, form({ country: "CA" }));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("US residents") });
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("logs, without throwing, when the clean-up delete throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.insert.mockResolvedValueOnce({ error: { message: "insert failed" } });
    m.deleteUser.mockRejectedValueOnce(new Error("network down"));
    expect(await signUpAction(null, form())).toMatchObject({ ok: false });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("user-1"), "network down");
    log.mockRestore();
  });

  it("logs, without throwing, when the clean-up delete also fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.insert.mockResolvedValueOnce({ error: { message: "insert failed" } });
    m.deleteUser.mockResolvedValueOnce({ error: { message: "delete failed" } });
    expect(await signUpAction(null, form())).toMatchObject({ ok: false });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("user-1"), "delete failed");
    log.mockRestore();
  });

  it("refuses an underage applicant without calling Supabase", async () => {
    const result = await signUpAction(null, form({ birthDate: "2020-01-01" }));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("aged 18 or over") });
    expect(m.createUser).not.toHaveBeenCalled();
  });
});
