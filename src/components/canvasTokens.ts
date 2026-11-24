import type { ArrowFlipColors } from "@/challenges/arrow-flip/render";
import type { BankShotColors } from "@/challenges/bank-shot/render";
import type { EchoPathColors } from "@/challenges/echo-path/render";
import type { FairSplitColors } from "@/challenges/fair-split/render";
import type { FlashCountFrame } from "@/challenges/flash-count/render";
import { BOARD_TOKEN as INK_BOARD_TOKEN, HALO_TOKEN as INK_HALO_TOKEN, INK_SWATCHES } from "@/challenges/ink/palette";
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

export const BANK_SHOT_COLOR_TOKENS: Record<keyof BankShotColors, string> = {
  board: "--fs-color-meter-surface",
  wall: "--fs-color-text",
  line: "--fs-color-tangerine",
  strip: "--fs-color-surface-strong",
  puck: "--fs-color-mint",
  bumper: "--fs-color-mint-dark",
  marker: "--fs-color-tangerine",
  crossing: "--fs-color-mint-dark",
  path: "--fs-color-mint",
  miss: "--fs-color-tangerine",
  text: "--fs-color-text",
};

export const ARROW_FLIP_COLOR_TOKENS: Record<keyof ArrowFlipColors, string> = {
  board: "--fs-color-meter-surface",
  arrow: "--fs-color-mint",
  word: "--fs-color-text",
  badge: "--fs-color-tangerine",
  right: "--fs-color-mint",
  wrong: "--fs-color-tangerine",
  bar: "--fs-color-mint",
  track: "--fs-color-surface-strong",
  text: "--fs-color-text",
};

export const INK_COLOR_TOKENS: Record<keyof InkColors, string> = {
  board: INK_BOARD_TOKEN,
  halo: INK_HALO_TOKEN,
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
