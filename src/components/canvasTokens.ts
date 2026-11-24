import type { BankShotColors } from "@/challenges/bank-shot/render";
import type { EchoPathColors } from "@/challenges/echo-path/render";
import type { FairSplitColors } from "@/challenges/fair-split/render";
import type { FlashCountFrame } from "@/challenges/flash-count/render";
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

export const CANVAS_COLOR_TOKENS: Record<keyof StackingColors, string> = {
  empty: "--fs-color-surface-strong",
  tower: "--fs-color-mint",
  moving: "--fs-color-tangerine",
  falling: "--fs-color-mint-dark",
  target: "--fs-color-mint-light",
};
