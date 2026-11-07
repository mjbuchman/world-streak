// Enforces two rules from docs/UI_GUIDELINES.md that are easy to check by machine:
// no emojis outside the share text, and no em dashes in source files.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Pictographs, flag halves (regional indicators) and the keycap mark. The plain legal
// symbols (c), (r) and TM are pictographic in Unicode but are ordinary text, so allow them.
const EMOJI = /(?![©®™])[\p{Extended_Pictographic}\p{Regional_Indicator}⃣]/u;
const EM_DASH = "—";
// The share text may live in src/lib/share.ts or under src/lib/share/.
const SHARE_TEXT = /^src\/lib\/share(\/|\.)/;
const EM_DASH_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html", ".json", ".md", ".svg", ".txt",
]);

function findViolations(relPath: string, content: string): string[] {
  const posixPath = relPath.split(path.sep).join("/");
  const violations: string[] = [];
  content.split("\n").forEach((line, index) => {
    const where = `${posixPath}:${index + 1}`;
    if (!SHARE_TEXT.test(posixPath) && EMOJI.test(line)) violations.push(`${where} contains an emoji`);
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

  it("allows emojis in the share text module, as a file or a folder", () => {
    expect(findViolations("src/lib/share.ts", `const win = "${partyPopper}";`)).toEqual([]);
    expect(findViolations("src/lib/share/text.ts", `const win = "${partyPopper}";`)).toEqual([]);
  });

  it("does not exempt look-alike paths from the emoji rule", () => {
    expect(findViolations("src/lib/shareholder.ts", partyPopper)).toEqual(["src/lib/shareholder.ts:1 contains an emoji"]);
  });

  it("still flags em dashes in the share text module", () => {
    expect(findViolations("src/lib/share.ts", `a ${EM_DASH} b`)).toEqual(["src/lib/share.ts:1 contains an em dash"]);
  });

  it("flags flag emojis and keycap emojis", () => {
    const usFlag = String.fromCodePoint(0x1f1fa, 0x1f1f8);
    const keycapOne = "1️⃣";
    for (const emoji of [usFlag, keycapOne]) {
      expect(findViolations("src/a.tsx", emoji)).toEqual(["src/a.tsx:1 contains an emoji"]);
    }
  });

  it("allows the plain copyright, registered and trademark symbols", () => {
    expect(findViolations("src/a.tsx", "© 2027 Sponsor® Game™")).toEqual([]);
  });

  it("flags emojis in other text file types", () => {
    expect(findViolations("src/page.html", sparkles)).toEqual(["src/page.html:1 contains an emoji"]);
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
