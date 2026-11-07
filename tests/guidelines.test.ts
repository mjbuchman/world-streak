// Enforces two rules from docs/UI_GUIDELINES.md that are easy to check by machine:
// no emojis outside the share text, and no em dashes in source files.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EMOJI = /\p{Extended_Pictographic}/u;
const EM_DASH = "—";
const SHARE_DIR = "src/lib/share/";
const EM_DASH_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".mjs", ".json", ".md", ".svg", ".txt"]);

export function findViolations(relPath: string, content: string): string[] {
  const posixPath = relPath.split(path.sep).join("/");
  const violations: string[] = [];
  content.split("\n").forEach((line, index) => {
    const where = `${posixPath}:${index + 1}`;
    if (!posixPath.startsWith(SHARE_DIR) && EMOJI.test(line)) violations.push(`${where} contains an emoji`);
    if (EM_DASH_EXTENSIONS.has(path.extname(posixPath)) && line.includes(EM_DASH)) {
      violations.push(`${where} contains an em dash`);
    }
  });
  return violations;
}

function listTextFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTextFiles(full);
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });
}

const sparkles = String.fromCodePoint(0x2728);
const partyPopper = String.fromCodePoint(0x1f389);

describe("findViolations", () => {
  it("flags an emoji in a component", () => {
    expect(findViolations("src/components/Button.tsx", `<button>${sparkles} Play</button>`)).toEqual([
      "src/components/Button.tsx:1 contains an emoji",
    ]);
  });

  it("allows emojis in the share text module", () => {
    expect(findViolations("src/lib/share/shareText.ts", `const win = "${partyPopper}";`)).toEqual([]);
  });

  it("flags an em dash in ts, tsx and css files, with the line number", () => {
    for (const file of ["src/a.ts", "src/b.tsx", "src/c.css"]) {
      expect(findViolations(file, `ok\nbad ${EM_DASH} line`)).toEqual([`${file}:2 contains an em dash`]);
    }
  });

  it("ignores em dashes in other file types", () => {
    expect(findViolations("src/notes.md", `a ${EM_DASH} b`)).toEqual([]);
  });

  it("accepts plain text with en dashes and hyphens", () => {
    expect(findViolations("src/a.tsx", "Pages 1–3 - done")).toEqual([]);
  });
});

describe("source tree", () => {
  it("follows the emoji and em dash rules", () => {
    const root = process.cwd();
    const violations = listTextFiles(path.join(root, "src")).flatMap((file) =>
      findViolations(path.relative(root, file), readFileSync(file, "utf8")),
    );
    expect(violations).toEqual([]);
  });
});
