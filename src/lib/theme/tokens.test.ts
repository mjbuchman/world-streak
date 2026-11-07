import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Hct, argbFromHex } from "@material/material-color-utilities";
import { BRAND_SEED_HEX } from "@/lib/config";
import { COLOR_ROLE_NAMES, buildTokenCss, colorRoles } from "./tokens";

function contrastRatio(hexA: string, hexB: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("colorRoles", () => {
  it.each([false, true])("returns a #rrggbb value for every Material 3 role (dark=%s)", (isDark) => {
    const roles = colorRoles(BRAND_SEED_HEX, isDark);
    expect(Object.keys(roles).sort()).toEqual([...COLOR_ROLE_NAMES].sort());
    for (const value of Object.values(roles)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each([false, true])("keeps text on primary and on surface readable (dark=%s)", (isDark) => {
    const roles = colorRoles(BRAND_SEED_HEX, isDark);
    expect(contrastRatio(roles["primary"], roles["on-primary"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(roles["surface"], roles["on-surface"])).toBeGreaterThanOrEqual(4.5);
  });

  it("produces a primary that stays close to the brand hue", () => {
    const seedHue = Hct.fromInt(argbFromHex(BRAND_SEED_HEX)).hue;
    const primaryHue = Hct.fromInt(argbFromHex(colorRoles(BRAND_SEED_HEX, false)["primary"])).hue;
    expect(hueDistance(seedHue, primaryHue)).toBeLessThan(15);
  });

  it("gives light and dark schemes different surfaces", () => {
    expect(colorRoles(BRAND_SEED_HEX, false)["surface"]).not.toBe(colorRoles(BRAND_SEED_HEX, true)["surface"]);
  });

  it("follows the seed: a different seed gives a different primary", () => {
    expect(colorRoles("#1f6f5c", false)["primary"]).not.toBe(colorRoles(BRAND_SEED_HEX, false)["primary"]);
  });

  it.each(["B5532A", "#B5532", "#GG0000", ""])("rejects an invalid seed %j", (seed) => {
    expect(() => colorRoles(seed, false)).toThrow(/seed/i);
  });
});

describe("buildTokenCss", () => {
  const css = buildTokenCss(BRAND_SEED_HEX);

  it("is deterministic", () => {
    expect(buildTokenCss(BRAND_SEED_HEX)).toBe(css);
  });

  it("defines every light color role on :root", () => {
    const light = colorRoles(BRAND_SEED_HEX, false);
    const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
    for (const name of COLOR_ROLE_NAMES) {
      expect(rootBlock).toContain(`--md-sys-color-${name}: ${light[name]};`);
    }
  });

  it("redefines every color role for dark mode under prefers-color-scheme", () => {
    const dark = colorRoles(BRAND_SEED_HEX, true);
    const darkBlock = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    expect(darkBlock.length).toBeGreaterThan(0);
    for (const name of COLOR_ROLE_NAMES) {
      expect(darkBlock).toContain(`--md-sys-color-${name}: ${dark[name]};`);
    }
  });

  it("defines the shape, spacing, type and motion scales", () => {
    for (const token of [
      "--md-sys-shape-corner-small: 8px;",
      "--md-sys-shape-corner-medium: 12px;",
      "--md-sys-shape-corner-large: 16px;",
      "--space-2: 8px;",
      "--md-sys-typescale-display-large-size: 57px;",
      "--md-sys-typescale-body-large-size: 16px;",
      "--md-sys-typescale-label-large-weight: 500;",
      "--md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("matches the committed src/app/tokens.css (run `npm run tokens` after changing the seed)", () => {
    const committed = readFileSync(path.join(process.cwd(), "src", "app", "tokens.css"), "utf8");
    expect(committed.replace(/\r\n/g, "\n")).toBe(css);
  });
});
