import Link from "next/link";
import styles from "./SiteFooter.module.css";

/** On every page: the official rules, as a prize game must link them (T38). */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Link href="/rules" className={styles.link}>
        Official rules
      </Link>
    </footer>
  );
}
