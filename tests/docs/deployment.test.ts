import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guideText = readFileSync("docs/DEPLOYMENT.md", "utf8");
// Whole names only, so FOO does not pass because FOO_BAR is in the guide.
const guide = { includes: (name: string) => new RegExp(`(?<![A-Z0-9_])${name}(?![A-Z0-9_])`).test(guideText) };

/** Variable names set or commented out in .env.example, e.g. `FOO=` or `# FOO=bar`. */
function exampleNames(): string[] {
  const lines = readFileSync(".env.example", "utf8").split(/\r?\n/);
  return lines.flatMap((line) => /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line)?.[1] ?? []);
}

/** Every `process.env.X` the app reads (tests aside), so a variable missing from .env.example is still caught. */
function appNames(dir = "src"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return appNames(path);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [...readFileSync(path, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
  });
}

describe("docs/DEPLOYMENT.md", () => {
  it("names every variable in .env.example", () => {
    const names = exampleNames();
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !guide.includes(name))).toEqual([]);
  });

  it("names every variable the app reads, except Node's own", () => {
    const names = [...new Set(appNames())].filter((name) => name !== "NODE_ENV");
    expect(names).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(names.filter((name) => !guide.includes(name))).toEqual([]);
  });

  it("gives the exact SQL that makes the owner an admin", () => {
    expect(guideText).toContain("update profiles set is_admin = true where id = (select id from auth.users where email = '<owner email>')");
  });
});
