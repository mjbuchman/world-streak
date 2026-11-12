import { describe, expect, it, vi } from "vitest";
import { envLocalLines, runEnvLocal } from "../../scripts/env-local.mts";

const STATUS = [
  'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"',
  'SUPABASE_SERVICE_ROLE_KEY="service-key"',
  'PUBLISHABLE_KEY="sb_publishable_x"',
].join("\n");

function deps(readStatus: () => string) {
  return { readStatus, log: vi.fn(), logError: vi.fn() };
}

describe("envLocalLines", () => {
  it("is the three .env.local lines, in order", () => {
    expect(
      envLocalLines({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" }),
    ).toBe("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=a\nSUPABASE_SERVICE_ROLE_KEY=s");
  });
});

describe("runEnvLocal", () => {
  it("prints the lines from the local status (never the publishable or secret keys)", () => {
    const d = deps(() => STATUS);
    expect(runEnvLocal(d)).toBe(0);
    const printed = d.log.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key\nSUPABASE_SERVICE_ROLE_KEY=service-key");
    expect(printed).not.toContain("sb_publishable");
    expect(d.logError).not.toHaveBeenCalled();
  });

  it("says in one line that Supabase is stopped", () => {
    const d = deps(() => {
      throw new Error("exit 1");
    });
    expect(runEnvLocal(d)).toBe(1);
    expect(d.logError).toHaveBeenCalledWith(expect.stringMatching(/not running.*npm run db:start/));
    expect(d.log).not.toHaveBeenCalled();
  });

  it("refuses a status that points at a real project", () => {
    const d = deps(() => STATUS.replace("http://127.0.0.1:54321", "https://abc.supabase.co"));
    expect(runEnvLocal(d)).toBe(1);
    expect(d.logError).toHaveBeenCalledWith(expect.stringMatching(/print \.env\.local values/));
    expect(d.log).not.toHaveBeenCalled();
  });
});
