import type { EchoPathColors } from "@/challenges/echo-path/render";
import type { FairSplitColors } from "@/challenges/fair-split/render";
import type { FlashCountFrame } from "@/challenges/flash-count/render";
import { BOARD_TOKEN as INK_BOARD_TOKEN, OUTLINE_TOKEN as INK_OUTLINE_TOKEN, INK_SWATCHES } from "@/challenges/ink/palette";
import type { InkColors } from "@/challenges/ink/render";
import type { StackingColors } from "@/challenges/stacking/render";

/**
 * The Fresh Sport colour token behind each canvas colour. A plain module, so the e2e look check
 * can import the same lists without loading the components' CSS.
 */
export const FLASH_COUNT_COLOR_TOKENS: Record<keyof FlashCountFrame["colors"], string> = {
  board: "--fs-color-meter-surface",
  dot: "--fs-color-mint",
};

export const ECHO_PATH_COLOR_TOKENS: Record<keyof EchoPathColors, string> = {
  board: "--fs-color-meter-surface",
  tile: "--fs-color-surface-strong",
  lit: "--fs-color-mint",
  trail: "--fs-color-mint",
  pressed: "--fs-color-mint-light",
  miss: "--fs-color-tangerine",
  start: "--fs-color-mint-dark",
  finish: "--fs-color-tangerine",
  focus: "--fs-color-text",
};

export const FAIR_SPLIT_COLOR_TOKENS: Record<keyof FairSplitColors, string> = {
  board: "--fs-color-meter-surface",
  shape: "--fs-color-mint",
  left: "--fs-color-mint",
  right: "--fs-color-mint-light",
  line: "--fs-color-tangerine",
  ring: "--fs-color-tangerine",
  track: "--fs-color-surface-strong",
  miss: "--fs-color-tangerine",
  text: "--fs-color-text",
};

export const INK_COLOR_TOKENS: Record<keyof InkColors, string> = {
  board: INK_BOARD_TOKEN,
  outline: INK_OUTLINE_TOKEN,
  red: INK_SWATCHES.red.token,
  blue: INK_SWATCHES.blue.token,
  yellow: INK_SWATCHES.yellow.token,
  black: INK_SWATCHES.black.token,
  right: "--fs-color-mint",
  wrong: "--fs-color-tangerine",
  bar: "--fs-color-mint",
  track: "--fs-color-surface-strong",
  text: "--fs-color-text",
};

export const CANVAS_COLOR_TOKENS: Record<keyof StackingColors, string> = {
  empty: "--fs-color-surface-strong",
  tower: "--fs-color-mint",
  moving: "--fs-color-tangerine",
  falling: "--fs-color-mint-dark",
  target: "--fs-color-mint-light",
};
