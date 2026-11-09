"use client";

import type { ButtonHTMLAttributes } from "react";
import { SpinnerRing } from "./Spinner";
import styles from "./ui.module.css";
import { usePrefersReducedMotion } from "./useReducedMotion";

export type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  /** Shows a spinner over the label (which stays, so the width does not jump) and blocks presses. */
  loading?: boolean;
};

/**
 * The pill button: tangerine for the screen's main action, translucent for the rest. While
 * loading it is aria-disabled rather than disabled, so keyboard focus stays on it.
 */
export function Button({ variant = "primary", loading = false, disabled, children, type = "button", onClick, ...rest }: ButtonProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <button
      {...rest}
      type={type}
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        // A busy button ignores presses, including a form submit.
        if (loading) return event.preventDefault();
        onClick?.(event);
      }}
    >
      <span className={loading ? styles.labelHidden : undefined}>{children}</span>
      {loading && (
        <span className={styles.buttonSpinner}>
          <SpinnerRing still={reduced} />
        </span>
      )}
    </button>
  );
}
