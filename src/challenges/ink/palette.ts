import type { Colour } from "./engine";

/**
 * Ink's four inks (T250). The board is dark, so the two dark inks (red and black) are drawn with a
 * light halo around every letter and the light ones (blue and yellow) straight on the board: each
 * ink meets 4.5:1 against what is right around it. The inks also differ in lightness by at least
 * MIN_LUMINANCE_GAP, so they can be told apart without seeing hue, and every button carries its name.
 */

/** The smallest relative-luminance difference between any two inks. */
export const MIN_LUMINANCE_GAP = 0.15;

export type InkSwatch = {
  /** The button's name and the word the feedback uses. */
  label: string;
  /** The Fresh Sport token for the ink (and its button's fill). */
  token: string;
  /** True when the ink is dark and needs the light halo on the dark board. */
  halo: boolean;
  /** The token for the label text on the ink's button. */
  labelToken: string;
};

const LIGHT = "--fs-color-text";
const DARK = "--fs-color-on-mint";

export const INK_SWATCHES: Record<Colour, InkSwatch> = {
  red: { label: "Red", token: "--fs-color-ink-red", halo: true, labelToken: LIGHT },
  blue: { label: "Blue", token: "--fs-color-ink-blue", halo: false, labelToken: DARK },
  yellow: { label: "Yellow", token: "--fs-color-ink-yellow", halo: false, labelToken: DARK },
  black: { label: "Black", token: "--fs-color-ink-black", halo: true, labelToken: LIGHT },
};

/** The board behind the inks and the halo drawn around the dark ones. */
export const BOARD_TOKEN = "--fs-color-meter-surface";
export const HALO_TOKEN = LIGHT;
