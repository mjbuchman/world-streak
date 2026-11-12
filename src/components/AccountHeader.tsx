import Link from "next/link";
import { GAME_NAME } from "@/config/game";
import styles from "./AccountHeader.module.css";
import { AccountStatus } from "./AccountStatus";

/** "World Streak" as the wordmark: lower case, the last word in mint. */
function Wordmark() {
  const words = GAME_NAME.toLowerCase().split(" ");
  const last = words.pop();
  return (
    <span aria-hidden="true">
      {words.join("")}
      <span className={styles.accent}>{last}</span>
    </span>
  );
}

/**
 * The top bar: the wordmark home, and the account state on the right. It reads no cookies, so
 * pages that do not depend on the player stay static; the account loads in the browser.
 */
export function AccountHeader() {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.name} aria-label={GAME_NAME}>
        <Wordmark />
      </Link>
      <AccountStatus />
    </header>
  );
}
