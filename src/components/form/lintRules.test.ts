import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Next's dev build of React warns "Each child in a list should have a unique key prop" when a
// key follows a prop spread (JSX then compiles to createElement). Vitest runs the stable React,
// which stays quiet, so the lint rule is what keeps the warning from coming back.
const eslint = new ESLint({ cwd: path.resolve(import.meta.dirname, "../../..") });

async function ruleIds(code: string, filePath = "src/components/form/Example.tsx"): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId ?? "");
}

const KEY_AFTER_SPREAD = 'export const x = (p: object) => <select {...p} key="a" />;';

describe("JSX key lint rules", () => {
  it("rejects a key placed after a prop spread", async () => {
    expect(await ruleIds(KEY_AFTER_SPREAD)).toContain("no-restricted-syntax");
  }, 30_000);

  // The challenge purity rules replace the no-restricted-syntax list there, so it must repeat this one.
  it("rejects it in challenge code too", async () => {
    expect(await ruleIds(KEY_AFTER_SPREAD, "src/challenges/stacking/Example.tsx")).toContain("no-restricted-syntax");
  }, 30_000);

  it("accepts a key placed before a prop spread", async () => {
    expect(await ruleIds('export const x = (p: object) => <select key="a" {...p} />;')).toEqual([]);
  }, 30_000);

  it("rejects an unkeyed element in a mapped list", async () => {
    const code = "export const x = (xs: string[]) => <ul>{xs.map((s) => <li>{s}</li>)}</ul>;";
    expect(await ruleIds(code)).toContain("react/jsx-key");
  }, 30_000);
});
