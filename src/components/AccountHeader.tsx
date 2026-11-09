import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { GAME_NAME } from "@/config/game";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./AccountHeader.module.css";

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

/** The top bar: the wordmark home, and the account state on the right. */
export async function AccountHeader() {
  const supabase = await createSupabaseServerClient();
  // The proxy has already refreshed the session for this request.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;

  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.name} aria-label={GAME_NAME}>
        <Wordmark />
      </Link>
      {email ? (
        <form action={signOutAction} className={styles.account}>
          <span aria-hidden="true" className={styles.initial}>
            {email.charAt(0).toUpperCase()}
          </span>
          <span className={styles.email}>{email}</span>
          <button type="submit" className={styles.textButton}>
            Sign out
          </button>
        </form>
      ) : (
        <Link href="/signin" className={styles.textButton}>
          Sign in
        </Link>
      )}
    </header>
  );
}
