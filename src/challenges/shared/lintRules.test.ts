import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Engines must be pure functions of (seed, inputs) so the server can replay them; the
// ESLint config enforces that. These tests prove the rule is wired to the right files.
const eslint = new ESLint({ cwd: path.resolve(import.meta.dirname, "../../..") });

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId ?? "");
}

const IMPURE = [
  ["Math.random", "export const x = Math.random();", "no-restricted-properties"],
  ["Date.now", "export const x = Date.now();", "no-restricted-properties"],
  ["new Date()", "export const x = new Date();", "no-restricted-syntax"],
  ["performance", "export const x = performance.now();", "no-restricted-globals"],
  ["window", "export const x = window.innerWidth;", "no-restricted-globals"],
  ["document", "export const x = document.title;", "no-restricted-globals"],
  ["fetch", 'export const x = fetch("/api");', "no-restricted-globals"],
  ["crypto", "export const x = crypto.randomUUID();", "no-restricted-globals"],
  ["setTimeout", "export const x = setTimeout(() => {}, 1);", "no-restricted-globals"],
  ["requestAnimationFrame", "export const x = requestAnimationFrame(() => {});", "no-restricted-globals"],
  ["globalThis", "export const x = globalThis.fetch;", "no-restricted-globals"],
  ["self", "export const x = self.window;", "no-restricted-globals"],
] as const;

describe("challenge purity lint rules", () => {
  it.each(IMPURE)("bans %s in challenge engines", async (_name, code, rule) => {
    expect(await ruleIds("src/challenges/stacking/engine.ts", code)).toContain(rule);
  }, 30_000);

  it.each(IMPURE)("allows %s in render.ts, which draws to the canvas", async (_name, code) => {
    expect(await ruleIds("src/challenges/stacking/render.ts", code)).toEqual([]);
  }, 30_000);

  it("does not apply outside src/challenges", async () => {
    expect(await ruleIds("src/lib/clock.ts", "export const x = Date.now();")).toEqual([]);
  }, 30_000);
});
