"use client";

import styles from "./ui.module.css";
import { usePrefersReducedMotion } from "./useReducedMotion";

/**
 * A loading indicator with its label for screen readers (or shown next to it with
 * `visibleLabel`). With reduced motion it holds still (a soft pulse is also motion, so it is a
 * plain ring).
 */
export function Spinner({ label = "Loading", visibleLabel = false }: { label?: string; visibleLabel?: boolean }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span role="status" className={styles.spinnerWrap}>
      <SpinnerRing still={reduced} />
      <span className={visibleLabel ? styles.spinnerLabel : "visually-hidden"}>{label}</span>
    </span>
  );
}

/** The ring alone, for places that announce their own state (a busy button). */
export function SpinnerRing({ still = false }: { still?: boolean }) {
  return <span aria-hidden="true" data-spinner="" data-motion={still ? "still" : "spin"} className={styles.spinner} />;
}
