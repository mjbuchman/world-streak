import type { Direction } from "./engine";

/** A swipe shorter than this (CSS px) is a tap or a slip, not an answer. */
export const MIN_SWIPE_PX = 24;

/**
 * The direction of a swipe from its start to its end, in screen coordinates (y grows downward), or
 * null if it is shorter than `minPx`. An exact diagonal resolves to its horizontal side, so the
 * result never depends on chance.
 */
export function swipeDirection(dx: number, dy: number, minPx = MIN_SWIPE_PX): Direction | null {
  if (Math.hypot(dx, dy) < minPx) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

const KEYS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

/** The direction an arrow key names, or null for any other key. */
export const keyDirection = (key: string): Direction | null => KEYS[key] ?? null;

/** The on-screen buttons, in the order they are laid out, with their accessible names. */
export const BUTTONS: readonly { dir: Direction; name: string }[] = [
  { dir: "left", name: "Left" },
  { dir: "up", name: "Up" },
  { dir: "down", name: "Down" },
  { dir: "right", name: "Right" },
];
