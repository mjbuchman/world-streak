import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE, TEXT_PAIRS, composite, contrastRatio } from "./palette";

const tokensCss = readFileSync(path.resolve(import.meta.dirname, "../../app/tokens.css"), "utf8");

describe("contrastRatio", () => {
  it("matches the WCAG formula at the extremes and for a known pair", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // WCAG's own example: #767676 on white is just over 4.5:1.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("composite", () => {
  it("lays a translucent white over a colour", () => {
    expect(composite("rgba(255,255,255,0.5)", "#000000")).toBe("#808080");
    expect(composite("rgba(255,255,255,0)", "#123456")).toBe("#123456");
    expect(composite("#abcdef", "#000000")).toBe("#abcdef");
  });

  it("refuses a colour format it cannot read", () => {
    expect(() => composite("teal", "#000000")).toThrow(/Unsupported colour: teal/);
  });
});

describe("Fresh Sport palette", () => {
  it.each(TEXT_PAIRS)("$name is readable: at least $min:1", ({ text, background, min }) => {
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(min);
  });

  it("is the palette tokens.css uses (one source, no drift)", () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      const token = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      expect(tokensCss, `--fs-color-${token}`).toContain(`--fs-color-${token}: ${value};`);
    }
  });

  it("keeps the brand colours from the approved mockup", () => {
    expect(PALETTE).toMatchObject({ mint: "#34F5B5", tangerine: "#FF7A1A", text: "#F2FBF8", groundDeep: "#02191B" });
  });
});
