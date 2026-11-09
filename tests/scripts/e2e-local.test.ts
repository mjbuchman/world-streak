import { describe, expect, it } from "vitest";
import { localSupabaseEnv } from "../../scripts/e2e-local.mjs";

const status = [
  'ANON_KEY="ignored"',
  'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"',
  'SUPABASE_SERVICE_ROLE_KEY="service-key"',
  'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
].join("\n");

describe("localSupabaseEnv", () => {
  it("picks the three app variables out of `supabase status -o env` output", () => {
    expect(localSupabaseEnv(status)).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
  });

  it("accepts Windows line endings and unquoted values", () => {
    const crlf = status.replaceAll('"', "").replaceAll("\n", "\r\n");
    expect(localSupabaseEnv(crlf).SUPABASE_SERVICE_ROLE_KEY).toBe("service-key");
  });

  it("fails clearly when local Supabase is not running", () => {
    expect(() => localSupabaseEnv("")).toThrow(/npx supabase start/);
  });

  it("refuses a Supabase URL that is not on this machine", () => {
    const remote = status.replace("http://127.0.0.1:54321", "https://abc.supabase.co");
    expect(() => localSupabaseEnv(remote)).toThrow(/localhost/);
  });

  it("allows localhost as well as 127.0.0.1", () => {
    const named = status.replace("127.0.0.1:54321", "localhost:54321");
    expect(localSupabaseEnv(named).NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321");
  });
});
