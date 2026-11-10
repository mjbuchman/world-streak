"use client";

import type { CSSProperties } from "react";
import styles from "./ui.module.css";
import { usePrefersReducedMotion } from "./useReducedMotion";

// Fixed positions, sizes and timings (no randomness in render): a one-off burst of falling blocks.
const PIECES = [
  { left: 8, size: 14, delay: 0, spin: 18, tangerine: false },
  { left: 18, size: 10, delay: 120, spin: -30, tangerine: true },
  { left: 27, size: 16, delay: 60, spin: 40, tangerine: false },
  { left: 36, size: 9, delay: 220, spin: -12, tangerine: false },
  { left: 45, size: 13, delay: 30, spin: 25, tangerine: true },
  { left: 54, size: 11, delay: 180, spin: -40, tangerine: false },
  { left: 63, size: 15, delay: 90, spin: 12, tangerine: false },
  { left: 72, size: 10, delay: 260, spin: -22, tangerine: true },
  { left: 81, size: 14, delay: 40, spin: 35, tangerine: false },
  { left: 90, size: 9, delay: 150, spin: -16, tangerine: false },
  { left: 14, size: 8, delay: 320, spin: 28, tangerine: false },
  { left: 68, size: 8, delay: 340, spin: -34, tangerine: true },
];

/** Mint (and a few tangerine) blocks falling past a result. Nothing at all under reduced motion. */
export function Confetti() {
  if (usePrefersReducedMotion()) return null;
  return (
    <div aria-hidden="true" className={styles.confetti}>
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`${styles.piece} ${piece.tangerine ? styles.pieceTangerine : ""}`}
          style={
            {
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size,
              animationDelay: `${piece.delay}ms`,
              "--spin": `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
