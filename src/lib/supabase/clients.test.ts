import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn((...args: unknown[]) => ({ kind: "browser", args })),
  createServerClient: vi.fn((...args: unknown[]) => ({ kind: "server", args })),
  createClient: vi.fn((...args: unknown[]) => ({ kind: "admin", args })),
  cookieStore: { getAll: vi.fn(() => [{ name: "sb", value: "1" }]), set: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
  createServerClient: mocks.createServerClient,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createSupabaseAdminClient } from "./admin";
import { createSupabaseBrowserClient } from "./client";
import { createSupabaseServerClient } from "./server";

type CookieMethods = {
  getAll: () => unknown;
  setAll: (cookies: { name: string; value: string; options: object }[]) => void;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

afterEach(() => vi.unstubAllEnvs());

describe("createSupabaseBrowserClient", () => {
  it("uses the public URL and anon key", () => {
    createSupabaseBrowserClient();
    expect(mocks.createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon-key");
  });
});

describe("createSupabaseServerClient", () => {
  async function cookieMethods(): Promise<CookieMethods> {
    await createSupabaseServerClient();
    const [url, key, options] = mocks.createServerClient.mock.calls[0];
    expect([url, key]).toEqual(["http://127.0.0.1:54321", "anon-key"]);
    return (options as { cookies: CookieMethods }).cookies;
  }

  it("reads cookies from the request", async () => {
    expect((await cookieMethods()).getAll()).toEqual([{ name: "sb", value: "1" }]);
  });

  it("writes refreshed session cookies back", async () => {
    (await cookieMethods()).setAll([{ name: "sb", value: "2", options: { path: "/" } }]);
    expect(mocks.cookieStore.set).toHaveBeenCalledWith("sb", "2", { path: "/" });
  });

  it("ignores the cookie write error thrown while rendering a Server Component", async () => {
    const methods = await cookieMethods();
    mocks.cookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
    expect(() => methods.setAll([{ name: "sb", value: "3", options: {} }])).not.toThrow();
  });
});

describe("createSupabaseAdminClient", () => {
  it("uses the service role key and never persists a session", () => {
    createSupabaseAdminClient();
    expect(mocks.createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("throws when the service role key is missing", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createSupabaseAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
