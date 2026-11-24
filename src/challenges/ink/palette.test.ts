import { describe, expect, it } from "vitest";
import { PALETTE, contrastRatio, luminance } from "@/lib/theme/palette";
import { COLOURS } from "./engine";
import { BOARD_TOKEN, HALO_TOKEN, INK_SWATCHES, MIN_LUMINANCE_GAP } from "./palette";

const hex = (token: string) => PALETTE[token.replace("--fs-color-", "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) as keyof typeof PALETTE];
const board = hex(BOARD_TOKEN);
const halo = hex(HALO_TOKEN);

describe("Ink palette (T250)", () => {
  it("names the four inks in the buttons' order, with no green", () => {
    expect(COLOURS.map((c) => INK_SWATCHES[c].label)).toEqual(["Red", "Blue", "Yellow", "Black"]);
    expect(JSON.stringify(INK_SWATCHES)).not.toMatch(/green/i);
    for (const c of COLOURS) expect(hex(INK_SWATCHES[c].token), c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("keeps every pair of inks at least the minimum apart in lightness", () => {
    const lums = COLOURS.map((c) => luminance(hex(INK_SWATCHES[c].token)));
    for (let i = 0; i < lums.length; i++) for (let j = i + 1; j < lums.length; j++) expect(Math.abs(lums[i] - lums[j]), `${COLOURS[i]}/${COLOURS[j]}`).toBeGreaterThanOrEqual(MIN_LUMINANCE_GAP);
  });

  it("draws each ink at least 4.5:1 against what is around it: the halo for dark inks, the board for light ones", () => {
    for (const c of COLOURS) {
      const { token, halo: haloed } = INK_SWATCHES[c];
      expect(contrastRatio(hex(token), haloed ? halo : board), c).toBeGreaterThanOrEqual(4.5);
      // The halo itself stands out from the board, so a haloed word is never lost on it.
      if (haloed) expect(contrastRatio(halo, board)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("checks yellow and black against both the dark board and the light halo, and haloes only the one that needs it", () => {
    expect(contrastRatio(hex(INK_SWATCHES.yellow.token), board)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex(INK_SWATCHES.yellow.token), halo)).toBeLessThan(4.5);
    expect(INK_SWATCHES.yellow.halo).toBe(false);
    expect(contrastRatio(hex(INK_SWATCHES.black.token), halo)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex(INK_SWATCHES.black.token), board)).toBeLessThan(4.5);
    expect(INK_SWATCHES.black.halo).toBe(true);
  });

  it("keeps each button's label at least 4.5:1 on its button", () => {
    for (const c of COLOURS) expect(contrastRatio(hex(INK_SWATCHES[c].labelToken), hex(INK_SWATCHES[c].token)), c).toBeGreaterThanOrEqual(4.5);
  });
});
