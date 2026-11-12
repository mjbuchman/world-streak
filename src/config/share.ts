/**
 * How close to the survival threshold the world's pass rate must be for a share to become a call
 * for help: below `threshold + NEAR_THRESHOLD_MARGIN` (0.05 is 5 points). The design gives no
 * number; this is a placeholder (docs/DECISIONS.md, T32).
 */
export const NEAR_THRESHOLD_MARGIN = 0.05;
