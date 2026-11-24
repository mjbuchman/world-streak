import type { Colour } from "./engine";

/** The on-screen buttons and the keys 1 to 4, in the same order. */
export const BUTTON_ORDER: readonly Colour[] = ["red", "blue", "yellow", "black"];

/** The colour a number key names (1 Red, 2 Blue, 3 Yellow, 4 Black), or null for any other key. */
export function keyColour(key: string): Colour | null {
  const index = ["1", "2", "3", "4"].indexOf(key);
  return index === -1 ? null : BUTTON_ORDER[index];
}
