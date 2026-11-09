"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether the player asked their system for less motion. Components use it for animations CSS
 * alone cannot tone down (a canvas, a spinner that should hold still). Assumes full motion
 * where the browser cannot say (server render, very old browsers).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia(QUERY).matches);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia(QUERY);
    const onChange = (event: { matches: boolean }) => setReduced(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
