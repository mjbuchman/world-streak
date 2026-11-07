import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { GAME_NAME } from "@/config/game";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./AccountHeader.module.css";

/** Small top app bar: the game name, and the account state on the right. */
export async function AccountHeader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;

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
