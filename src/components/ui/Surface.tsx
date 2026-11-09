import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type SurfaceProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  as?: "div" | "section";
  /** "highlight" is the mint-tinted surface for the screen's featured item (today's challenge). */
  tone?: "plain" | "highlight";
  children: ReactNode;
};

/** A translucent surface on the teal ground. Use it only for things that are cards. */
export function Surface({ as: Tag = "div", tone = "plain", children, ...rest }: SurfaceProps) {
  return (
    <Tag {...rest} className={`${styles.surface} ${tone === "highlight" ? styles.highlight : ""}`}>
      {children}
    </Tag>
  );
}
