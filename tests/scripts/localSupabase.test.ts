import { describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ args })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { assertLocalSupabaseUrl, check, createServiceClient, isLocalSupabaseUrl } from "../../scripts/lib/localSupabase.mts";

describe("isLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://localhost"])("accepts %s", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    "https://abcdefgh.supabase.co",
    "http://127.0.0.1.example.com:54321",
    "http://127.0.0.1.nip.io",
    "http://localhost.evil.test",
    "http://my-localhost:54321",
    "not a url",
    "",
    undefined,
  ])("refuses %s", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });
});

describe("assertLocalSupabaseUrl", () => {
  it("passes a local URL", () => {
    expect(() => assertLocalSupabaseUrl("http://127.0.0.1:54321", "seed", "NEXT_PUBLIC_SUPABASE_URL")).not.toThrow();
  });

  it("names what it refuses to do, the setting and the URL it got", () => {
    expect(() => assertLocalSupabaseUrl("https://abc.supabase.co", "seed", "NEXT_PUBLIC_SUPABASE_URL")).toThrow(
      'Refusing to seed: NEXT_PUBLIC_SUPABASE_URL must be localhost or 127.0.0.1 (local Supabase), not "https://abc.supabase.co".',
    );
    expect(() => assertLocalSupabaseUrl(undefined, "run e2e tests", "the Supabase URL")).toThrow(
      'Refusing to run e2e tests: the Supabase URL must be localhost or 127.0.0.1 (local Supabase), not "".',
    );
  });
});

describe("createServiceClient", () => {
  it("makes a service-role client that never keeps or refreshes a session", () => {
    createServiceClient("http://127.0.0.1:54321", "service-key");
    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });
});

describe("check", () => {
  it("returns the data when there is no error", () => {
    expect(check("Lookup", { data: { id: 1 }, error: null })).toEqual({ id: 1 });
  });

  it("throws naming the step when there is an error", () => {
    expect(() => check("Lookup", { data: null, error: { message: "connection refused" } })).toThrow(
      "Lookup failed: connection refused",
    );
  });
});
