import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ createServerClient: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: m.createServerClient }));

import { updateSession } from "./session";

type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
    headers: Record<string, string>,
  ) => void;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  m.createServerClient.mockReturnValue({ auth: { getUser: m.getUser } });
  m.getUser.mockResolvedValue({ data: { user: null }, error: null });
});

function requestWithCookie() {
  return new NextRequest("http://localhost:3000/", { headers: { cookie: "sb-local-auth-token=old" } });
}

describe("updateSession", () => {
  it("asks Supabase for the user, which refreshes an expiring session", async () => {
    await updateSession(requestWithCookie());
    expect(m.getUser).toHaveBeenCalledTimes(1);
    const [url, key] = m.createServerClient.mock.calls[0];
    expect([url, key]).toEqual(["http://127.0.0.1:54321", "anon-key"]);
  });

  it("reads the request cookies", async () => {
    await updateSession(requestWithCookie());
    const cookies = m.createServerClient.mock.calls[0][2].cookies as CookieMethods;
    expect(cookies.getAll()).toEqual([{ name: "sb-local-auth-token", value: "old" }]);
  });

  it("writes refreshed cookies to both the forwarded request and the response", async () => {
    m.getUser.mockImplementation(async () => {
      const cookies = m.createServerClient.mock.calls[0][2].cookies as CookieMethods;
      cookies.setAll([{ name: "sb-local-auth-token", value: "new", options: { path: "/", httpOnly: true } }], {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      });
      return { data: { user: { id: "u1" } }, error: null };
    });
    const request = requestWithCookie();
    const response = await updateSession(request);
    expect(request.cookies.get("sb-local-auth-token")?.value).toBe("new");
    const set = response.cookies.get("sb-local-auth-token");
    expect(set?.value).toBe("new");
    expect(set?.httpOnly).toBe(true);
  });

  it("marks a response that refreshes the session as uncacheable, so no CDN can share it", async () => {
    m.getUser.mockImplementation(async () => {
      const cookies = m.createServerClient.mock.calls[0][2].cookies as CookieMethods;
      cookies.setAll([{ name: "sb-local-auth-token", value: "new", options: {} }], {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        Expires: "0",
        Pragma: "no-cache",
      });
      return { data: { user: { id: "u1" } }, error: null };
    });
    const response = await updateSession(requestWithCookie());
    expect(response.headers.get("cache-control")).toBe("private, no-cache, no-store, must-revalidate, max-age=0");
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("passes the request through untouched when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const response = await updateSession(requestWithCookie());
    expect(m.createServerClient).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
