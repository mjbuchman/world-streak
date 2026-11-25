import type { Colour } from "./engine";

/**
 * Ink's four inks (T250, outline T255). Every word, in all four inks, gets the same thin light
 * outline: one look for every ink instead of a thick halo on the dark ones only. The outline is
 * decorative; the inks differ in lightness by at least MIN_LUMINANCE_GAP, so they can be told apart
 * without seeing hue, and every button carries its name.
 */

/** The smallest relative-luminance difference between any two inks. */
export const MIN_LUMINANCE_GAP = 0.15;

export type InkSwatch = {
  /** The button's name and the word the feedback uses. */
  label: string;
  /** The Fresh Sport token for the ink (and its button's fill). */
  token: string;
  /** The token for the label text on the ink's button. */
  labelToken: string;
};

const LIGHT = "--fs-color-text";
const DARK = "--fs-color-on-mint";

export const INK_SWATCHES: Record<Colour, InkSwatch> = {
  red: { label: "Red", token: "--fs-color-ink-red", labelToken: LIGHT },
  blue: { label: "Blue", token: "--fs-color-ink-blue", labelToken: DARK },
  yellow: { label: "Yellow", token: "--fs-color-ink-yellow", labelToken: DARK },
  black: { label: "Black", token: "--fs-color-ink-black", labelToken: LIGHT },
};

/** The board behind the inks and the outline drawn around every word. */
export const BOARD_TOKEN = "--fs-color-meter-surface";
export const OUTLINE_TOKEN = LIGHT;
/** The outline's width in CSS px: thin, 1 to 2 px (the old halo was 20% of the type, "too thick"). */
export const OUTLINE_CSS_PX = 1.5;
