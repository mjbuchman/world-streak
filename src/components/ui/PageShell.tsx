import type { ReactNode } from "react";
import { BackButton } from "./BackButton";
import styles from "./ui.module.css";

type PageShellProps = {
  /** The page's h1; leave it out when the page draws its own. */
  title?: ReactNode;
  /** Where the back button goes; no back button when left out (the home page). */
  backHref?: string;
  children: ReactNode;
};

/** The main landmark with the standard width and padding, a back button and a title. */
export function PageShell({ title, backHref, children }: PageShellProps) {
  return (
    <main className={styles.shell}>
      {(backHref || title) && (
        <div className={styles.shellHeader}>
          {backHref && <BackButton href={backHref} />}
          {title && <h1 className={styles.shellTitle}>{title}</h1>}
        </div>
      )}
      {children}
    </main>
  );
}
