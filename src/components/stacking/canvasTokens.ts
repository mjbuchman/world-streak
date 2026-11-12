import type { StackingColors } from "@/challenges/stacking/render";

/**
 * The Fresh Sport colour token behind each canvas colour. A plain module, so the e2e look check
 * can import the same list without loading the component's CSS.
 */
export const CANVAS_COLOR_TOKENS: Record<keyof StackingColors, string> = {
  empty: "--fs-color-surface-strong",
  tower: "--fs-color-mint",
  moving: "--fs-color-tangerine",
  falling: "--fs-color-mint-dark",
  target: "--fs-color-mint-light",
};
