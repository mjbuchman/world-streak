"use client";

import { useSyncExternalStore } from "react";

// One clock for every component that shows time, ticking every second while any is mounted, so
// the meter and the countdown change together.
const listeners = new Set<() => void>();
let current: number | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const notify of listeners) notify();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      current = null;
    }
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => null;

/**
 * The current time in ms, ticking every second. Null on the server and in the first browser
 * render, so the two agree (no hydration mismatch from two different clocks).
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
