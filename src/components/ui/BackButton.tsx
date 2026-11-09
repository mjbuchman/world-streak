import Link from "next/link";
import styles from "./ui.module.css";

/** The round back button, top-left on every screen below home (docs/UI_GUIDELINES.md, rule 8). */
export function BackButton({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="Back" className={styles.back}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
