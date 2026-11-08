import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: m.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: m.from }) }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));

import { completeProfileAction } from "./actions";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ birthDate: "1990-05-05", country: "US", agree: "on", ...overrides })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  m.from.mockReturnValue({ insert: m.insert });
  m.insert.mockResolvedValue({ error: null });
});

afterEach(() => vi.useRealTimers());

describe("completeProfileAction", () => {
  it("creates the signed-in player's profile and sends them home", async () => {
    await expect(completeProfileAction(null, form())).rejects.toThrow(/^NEXT_REDIRECT \/$/);
    expect(m.from).toHaveBeenCalledWith("profiles");
    expect(m.insert).toHaveBeenCalledWith({ id: "u1", birth_date: "1990-05-05", country: "US" });
  });

  it("sends a visitor who is not signed in to sign in, without writing anything", async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: "session_not_found" } });
    await expect(completeProfileAction(null, form())).rejects.toThrow(/^NEXT_REDIRECT \/signin$/);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("checks age against the earliest US date, not UTC", async () => {
    // 07:00 UTC on 9 November is still 8 November in Hawaii, so a player born on
    // 9 November 2008 is not 18 yet.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-09T07:00:00Z") });
    const result = await completeProfileAction(null, form({ birthDate: "2008-11-09" }));
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("only to US residents aged 18") });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("treats a profile that already exists (a repeated submit) as done", async () => {
    m.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    await expect(completeProfileAction(null, form())).rejects.toThrow(/^NEXT_REDIRECT \/$/);
  });

  it("shows a generic error when the profile cannot be saved", async () => {
    m.insert.mockResolvedValueOnce({ error: { code: "08006" } });
    const result = await completeProfileAction(null, form());
    expect(result).toMatchObject({ ok: false, message: "Something went wrong. Please try again." });
    expect(m.redirect).not.toHaveBeenCalled();
  });
});
