import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The other client tests mock `server-only`, so this checks the guard itself is still in place:
// importing these modules from a Client Component must fail the build.
describe("server-only Supabase clients", () => {
  it.each(["admin.ts", "server.ts"])("%s starts with import \"server-only\"", (file) => {
    const source = readFileSync(path.join(import.meta.dirname, file), "utf8");
    expect(source.trimStart().startsWith('import "server-only";')).toBe(true);
  });
});
