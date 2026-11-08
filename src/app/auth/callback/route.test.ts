import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), landingPath: vi.fn() }));
const client = { auth: { exchangeCodeForSession: m.exchangeCodeForSession } };
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => client }));
vi.mock("@/lib/profiles", () => ({ landingPath: m.landingPath }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  m.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
});

async function callback(query: string) {
  const response = await GET(new NextRequest(`http://localhost:3000/auth/callback${query}`));
  return { status: response.status, location: response.headers.get("location") };
}

describe("GET /auth/callback", () => {
  it("exchanges the code and sends a player without a profile to complete it", async () => {
    m.landingPath.mockResolvedValueOnce("/complete-profile");
    expect(await callback("?code=abc")).toEqual({ status: 307, location: "http://localhost:3000/complete-profile" });
    expect(m.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(m.landingPath).toHaveBeenCalledWith(client, "u1");
  });

  it("sends a player who already has a profile home", async () => {
    m.landingPath.mockResolvedValueOnce("/");
    expect(await callback("?code=abc")).toEqual({ status: 307, location: "http://localhost:3000/" });
  });

  it("sends the player back to sign-in when there is no code (for example Google sign-in was cancelled)", async () => {
    expect(await callback("?error=access_denied")).toEqual({
      status: 307,
      location: "http://localhost:3000/signin?error=oauth",
    });
    expect(m.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sends the player back to sign-in when the code is invalid or expired", async () => {
    m.exchangeCodeForSession.mockResolvedValueOnce({ data: { user: null }, error: { code: "bad_code_verifier" } });
    expect(await callback("?code=stale")).toEqual({ status: 307, location: "http://localhost:3000/signin?error=oauth" });
    expect(m.landingPath).not.toHaveBeenCalled();
  });
});
