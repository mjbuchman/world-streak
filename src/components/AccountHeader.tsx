import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { GAME_NAME } from "@/config/game";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./AccountHeader.module.css";

/** Small top app bar: the game name, and the account state on the right. */
export async function AccountHeader() {
  const supabase = await createSupabaseServerClient();
  // getClaims verifies the token signature locally (no extra Auth round trip); the proxy has
  // already refreshed the session for this request.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims.email;

  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.name}>
        {GAME_NAME}
      </Link>
      {email ? (
        <form action={signOutAction} className={styles.account}>
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
