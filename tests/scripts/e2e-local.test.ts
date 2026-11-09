import { describe, expect, it, vi } from "vitest";
// TypeScript maps the .mjs specifier to the .mts source.
import { localSupabaseEnv, runE2e, type E2eDeps } from "../../scripts/e2e-local.mjs";

const status = [
  'ANON_KEY="ignored"',
  'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"',
  'SUPABASE_SERVICE_ROLE_KEY="service-key"',
  'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
].join("\n");

const appEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
};

describe("localSupabaseEnv", () => {
  it("picks the three app variables out of `supabase status -o env` output", () => {
    expect(localSupabaseEnv(status)).toEqual(appEnv);
  });

  it("accepts Windows line endings and unquoted values", () => {
    const crlf = status.replaceAll('"', "").replaceAll("\n", "\r\n");
    expect(localSupabaseEnv(crlf).SUPABASE_SERVICE_ROLE_KEY).toBe("service-key");
  });

  it("names what is missing when the status output lacks the keys", () => {
    expect(() => localSupabaseEnv("")).toThrow(/did not report NEXT_PUBLIC_SUPABASE_URL.*npx supabase start/);
  });

  it("refuses a Supabase URL that is not on this machine", () => {
    const remote = status.replace("http://127.0.0.1:54321", "https://abc.supabase.co");
    expect(() => localSupabaseEnv(remote)).toThrow(/localhost/);
  });

  it.each(["http://localhost.evil.com", "http://127.0.0.1.nip.io", "http://my-localhost:54321"])(
    "refuses look-alike host %s",
    (url) => {
      expect(() => localSupabaseEnv(status.replace("http://127.0.0.1:54321", url))).toThrow(/Refusing/);
    },
  );

  it("names a single missing key", () => {
    const noServiceKey = status.replace('SUPABASE_SERVICE_ROLE_KEY="service-key"', 'SUPABASE_SERVICE_ROLE_KEY=""');
    expect(() => localSupabaseEnv(noServiceKey)).toThrow(/did not report SUPABASE_SERVICE_ROLE_KEY\./);
  });

  it("allows localhost as well as 127.0.0.1", () => {
    const named = status.replace("127.0.0.1:54321", "localhost:54321");
    expect(localSupabaseEnv(named).NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost:54321");
  });
});

describe("runE2e", () => {
  function deps(overrides: Partial<E2eDeps> = {}) {
    return {
      readStatus: () => status,
      runPlaywright: vi.fn<E2eDeps["runPlaywright"]>(() => 0),
      logError: vi.fn<E2eDeps["logError"]>(),
      ...overrides,
    };
  }

  it("runs Playwright with the caller's arguments and the local keys, returning its exit code", () => {
    const fake = deps({ runPlaywright: vi.fn(() => 3) });
    expect(runE2e(["tests/e2e/practice.spec.ts"], fake)).toBe(3);
    expect(fake.runPlaywright).toHaveBeenCalledWith(["tests/e2e/practice.spec.ts"], appEnv);
  });

  it("says plainly that Supabase is stopped when the status command fails, without running Playwright", () => {
    const fake = deps({
      readStatus: () => {
        throw new Error("Command failed: npx supabase status");
      },
    });
    expect(runE2e([], fake)).toBe(1);
    expect(fake.logError).toHaveBeenCalledWith(expect.stringMatching(/not running.*npx supabase start/));
    expect(fake.runPlaywright).not.toHaveBeenCalled();
  });

  it("reports a refused URL as one line, without running Playwright", () => {
    const fake = deps({ readStatus: () => status.replace("127.0.0.1", "db.example.com") });
    expect(runE2e([], fake)).toBe(1);
    expect(fake.logError).toHaveBeenCalledWith(expect.stringMatching(/Refusing.*db\.example\.com/));
    expect(fake.runPlaywright).not.toHaveBeenCalled();
  });
});
