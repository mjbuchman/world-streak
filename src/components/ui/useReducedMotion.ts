"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => undefined;
  const media = matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const current = () => typeof matchMedia === "function" && matchMedia(QUERY).matches;

/**
 * Whether the player asked their system for less motion. Components use it for animations CSS
 * alone cannot tone down (a canvas, a spinner that should hold still). The server snapshot is
 * "full motion", and React swaps in the real value after hydration without a mismatch.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, current, () => false);
}
