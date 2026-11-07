import { afterEach, describe, expect, it, vi } from "vitest";
import { optionalPublicSupabaseEnv, publicSupabaseEnv, requireEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("requireEnv", () => {
  it("returns a value that is set", () => {
    expect(requireEnv("ANY_NAME", "value")).toBe("value");
  });

  it.each([undefined, ""])("throws a message naming the variable when the value is %j", (value) => {
    expect(() => requireEnv("SUPABASE_SERVICE_ROLE_KEY", value)).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY.*\.env\.example/,
    );
  });
});

describe("publicSupabaseEnv", () => {
  it("reads the public URL and anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(publicSupabaseEnv()).toEqual({ url: "http://127.0.0.1:54321", anonKey: "anon-key" });
  });

  it("throws when the URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(() => publicSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when the anon key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => publicSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});

describe("optionalPublicSupabaseEnv", () => {
  it("returns both settings when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(optionalPublicSupabaseEnv()).toEqual({ url: "http://127.0.0.1:54321", anonKey: "anon-key" });
  });

  it.each([
    ["the URL", "", "anon-key"],
    ["the anon key", "http://127.0.0.1:54321", ""],
  ])("returns null when %s is missing", (_label, url, key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
    expect(optionalPublicSupabaseEnv()).toBeNull();
  });
});
