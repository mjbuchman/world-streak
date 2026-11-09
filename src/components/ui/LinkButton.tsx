import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./ui.module.css";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & { variant?: "primary" | "secondary" };

/** A link with the button looks, for navigation (Play, Practice). No client code needed. */
export function LinkButton({ variant = "primary", ...rest }: LinkButtonProps) {
  return <Link {...rest} className={`${styles.button} ${styles[variant]}`} />;
}
