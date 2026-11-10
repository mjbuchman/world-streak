import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
