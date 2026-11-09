"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { SpinnerRing } from "./Spinner";
import styles from "./ui.module.css";
import { usePrefersReducedMotion } from "./useReducedMotion";

export type ButtonVariant = "primary" | "secondary";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  /** Shows a spinner over the label (which stays, so the width does not jump) and blocks presses. */
  loading?: boolean;
};

/** The pill button: tangerine for the screen's main action, translucent for the rest. */
export function Button({ variant = "primary", loading = false, disabled, children, type = "button", ...rest }: ButtonProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <button
      {...rest}
      type={type}
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
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

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & { variant?: ButtonVariant };

/** A link with the button looks, for navigation (Play, Practice). */
export function LinkButton({ variant = "primary", ...rest }: LinkButtonProps) {
  return <Link {...rest} className={`${styles.button} ${styles[variant]}`} />;
}
