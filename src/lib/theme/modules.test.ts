import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CELL_RADIUS_PX } from "@/challenges/stacking/render";

const src = path.resolve(import.meta.dirname, "../..");
const thisFile = path.resolve(import.meta.filename);

/** Every source and stylesheet file under src/, as paths relative to it. */
function sourceFiles(): string[] {
  return readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(css|tsx?)$/.test(file))
    .filter((file) => path.join(src, file) !== thisFile);
}

// T75 retired the Material names: only the Fresh Sport tokens (--fs-*) remain.
describe("Fresh Sport tokens only", () => {
  it("finds the source files to check", () => {
    expect(sourceFiles()).toContain(path.join("app", "tokens.css"));
  });

  it("no file under src/ uses a legacy --md- variable", () => {
    const offenders = sourceFiles().filter((file) => readFileSync(path.join(src, file), "utf8").includes("--md-"));
    expect(offenders).toEqual([]);
  });
});

const read = (file: string) => readFileSync(path.join(src, file), "utf8");
/** Custom properties a file declares, as `--name:` in CSS or a `"--name"` string (next/font, inline styles). */
const declaredIn = (text: string) => new Set([...text.matchAll(/(--[\w-]+)\s*:|["'`](--[\w-]+)["'`]/g)].map((m) => m[1] ?? m[2]));

// A misspelled var(--fs-…) silently resolves to nothing, so every one must be defined somewhere (T84).
describe("every var(--name) is defined", () => {
  it("in tokens.css, as a next/font variable, by a component's inline style, or in the same file", () => {
    // An inline style (for example Confetti's "--spin") feeds a variable to its CSS module.
    const inlineStyles = sourceFiles().filter((file) => file.endsWith(".tsx")).flatMap((file) => [...declaredIn(read(file))]);
    const global = new Set([...declaredIn(read(path.join("app", "tokens.css"))), ...declaredIn(read(path.join("app", "layout.tsx"))), ...inlineStyles]);
    const undefinedUses = sourceFiles().flatMap((file) => {
      const text = read(file);
      const local = declaredIn(text);
      return [...text.matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !global.has(name) && !local.has(name))
        .map((name) => `${file}: ${name}`);
    });
    expect(undefinedUses).toEqual([]);
  });

  it("would catch a misspelling", () => {
    const tokens = declaredIn("--fs-color-mint: #34f5b5;");
    expect([...("color: var(--fs-color-mnit);".matchAll(/var\(\s*(--[\w-]+)/g))].map((m) => m[1]).filter((n) => !tokens.has(n))).toEqual([
      "--fs-color-mnit",
    ]);
  });
});

describe("the canvas cell radius", () => {
  it("matches --fs-radius-cell", () => {
    expect(read(path.join("app", "tokens.css"))).toContain(`--fs-radius-cell: ${CELL_RADIUS_PX}px;`);
  });
});
