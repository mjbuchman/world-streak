"use client";

import styles from "./ui.module.css";
import { usePrefersReducedMotion } from "./useReducedMotion";

/**
 * A loading indicator with screen-reader text. With reduced motion it holds still (a soft
 * pulse is also motion, so it is a plain ring).
 */
export function Spinner({ label = "Loading" }: { label?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span role="status" className={styles.spinnerWrap}>
      <SpinnerRing still={reduced} />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

/** The ring alone, for places that announce their own state (a busy button). */
export function SpinnerRing({ still = false }: { still?: boolean }) {
  return <span aria-hidden="true" data-spinner="" data-motion={still ? "still" : "spin"} className={styles.spinner} />;
}
