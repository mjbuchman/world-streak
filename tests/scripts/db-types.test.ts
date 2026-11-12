import { describe, expect, it, vi } from "vitest";
import { type DbTypesDeps, runDbTypes, sameTypes, TYPES_FILE } from "../../scripts/db-types.mts";

function deps(committed: string, generated: string) {
  return { generate: () => generated, read: () => committed, write: vi.fn(), log: vi.fn() } satisfies DbTypesDeps;
}

describe("sameTypes", () => {
  it("ignores line endings and trailing blank lines", () => {
    expect(sameTypes("a\r\nb\r\n", "a\nb\n\n")).toBe(true);
  });

  it("notices any real difference", () => {
    expect(sameTypes("a\nb\n", "a\nc\n")).toBe(false);
  });
});

describe("runDbTypes", () => {
  it("writes the generated types with LF line endings", () => {
    const d = deps("old", "type A = 1;\r\n");
    expect(runDbTypes("write", d)).toBe(0);
    expect(d.write).toHaveBeenCalledWith("type A = 1;\n");
  });

  it("passes the check when the committed types match the schema", () => {
    const d = deps("type A = 1;\n", "type A = 1;\r\n");
    expect(runDbTypes("check", d)).toBe(0);
    expect(d.write).not.toHaveBeenCalled();
  });

  it("fails the check, saying how to fix it, when a migration changed the schema", () => {
    const d = deps("type A = 1;\n", "type A = 2;\n");
    expect(runDbTypes("check", d)).toBe(1);
    expect(d.log).toHaveBeenCalledWith(expect.stringContaining(`${TYPES_FILE} is out of date`));
    expect(d.write).not.toHaveBeenCalled();
  });
});
