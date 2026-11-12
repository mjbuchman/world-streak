import Link from "next/link";
import type { ComponentProps } from "react";
import type { ButtonVariant } from "./Button";
import styles from "./ui.module.css";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & { variant?: ButtonVariant };

/** A link with the button looks, for navigation (Play, Practice). No client code needed. */
export function LinkButton({ variant = "primary", ...rest }: LinkButtonProps) {
  return <Link {...rest} className={`${styles.button} ${styles[variant]}`} />;
}
