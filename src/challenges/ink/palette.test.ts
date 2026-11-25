import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTE, contrastRatio, luminance } from "@/lib/theme/palette";
import { COLOURS } from "./engine";
import { BOARD_TOKEN, INK_SWATCHES, MIN_LUMINANCE_GAP, OUTLINE_CSS_PX, OUTLINE_TOKEN } from "./palette";

const hex = (token: string) => PALETTE[token.replace("--fs-color-", "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof PALETTE];
const board = hex(BOARD_TOKEN);
const outline = hex(OUTLINE_TOKEN);

describe("Ink palette (T250, T255)", () => {
  it("names the four inks in the buttons' order, with no green", () => {
    expect(COLOURS.map((c) => INK_SWATCHES[c].label)).toEqual(["Red", "Blue", "Yellow", "Black"]);
    expect(JSON.stringify(INK_SWATCHES)).not.toMatch(/green/i);
    for (const c of COLOURS) expect(hex(INK_SWATCHES[c].token), c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("has no halo any more: one thin light outline of 1 to 2 px for every ink", () => {
    const source = readFileSync(new URL("./palette.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/halo:/);
    for (const c of COLOURS) expect(INK_SWATCHES[c]).not.toHaveProperty("halo");
    expect(OUTLINE_CSS_PX).toBe(1.5);
    expect(luminance(outline)).toBeGreaterThan(0.8);
  });

  it("keeps every pair of inks at least the minimum apart in lightness", () => {
    const lums = COLOURS.map((c) => luminance(hex(INK_SWATCHES[c].token)));
    for (let i = 0; i < lums.length; i++) for (let j = i + 1; j < lums.length; j++) expect(Math.abs(lums[i] - lums[j]), `${COLOURS[i]}/${COLOURS[j]}`).toBeGreaterThanOrEqual(MIN_LUMINANCE_GAP);
  });

  /*
   * The contrast rule since T255: the outline is decorative, so ink-on-board contrast is no longer
   * asserted for red and black (the old halo guaranteed it; owner to confirm they still read well).
   * Yellow and black stay checked against both backgrounds: yellow reads on the dark board, black on
   * the light outline, and the outline itself stands out from the board.
   */
  it("checks yellow and black against both the dark board and the light outline", () => {
    expect(contrastRatio(hex(INK_SWATCHES.yellow.token), board)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex(INK_SWATCHES.yellow.token), outline)).toBeLessThan(4.5);
    expect(contrastRatio(hex(INK_SWATCHES.black.token), outline)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex(INK_SWATCHES.black.token), board)).toBeLessThan(4.5);
    expect(contrastRatio(outline, board)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps each button's label at least 4.5:1 on its button", () => {
    for (const c of COLOURS) expect(contrastRatio(hex(INK_SWATCHES[c].labelToken), hex(INK_SWATCHES[c].token)), c).toBeGreaterThanOrEqual(4.5);
  });
});
