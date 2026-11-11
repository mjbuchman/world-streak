"use client";

import { useEffect } from "react";

/**
 * Marks `<html data-hydrated>` once React has hydrated the page, so end-to-end tests can wait for
 * a page to be interactive before typing or clicking (T78): on a cold dev compile, input typed
 * before hydration is wiped and clicks are lost. Renders nothing.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "";
  }, []);
  return null;
}
