"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/auth/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./AccountHeader.module.css";

type Account = { kind: "unknown" } | { kind: "signed-out" } | { kind: "signed-in"; email: string };

async function readAccount(): Promise<Account> {
  try {
    // Reads the session cookie the proxy keeps fresh; display only, so no server check is needed.
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    const email = data.session?.user.email;
    return email ? { kind: "signed-in", email } : { kind: "signed-out" };
  } catch {
    return { kind: "signed-out" };
  }
}

/**
 * The header's account state, loaded in the browser after first paint so the pages around it
 * can be static (T130). Sign-in and sign-out navigate inside the app without remounting the
 * header, so the session is read again on every route change.
 */
export function AccountStatus() {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account>({ kind: "unknown" });

  useEffect(() => {
    let current = true;
    void readAccount().then((next) => {
      if (current) setAccount(next);
    });
    return () => {
      current = false;
    };
  }, [pathname]);

  // Holds the space but shows nothing, so a visitor never sees the wrong state for a moment.
  if (account.kind === "unknown") return <span className={styles.pending} />;

  if (account.kind === "signed-out") {
    return (
      <Link href="/signin" className={styles.textButton}>
        Sign in
      </Link>
    );
  }

  // Sign-out on the home page redirects to the same path, so the route change alone would not
  // update the header.
  async function signOut() {
    setAccount({ kind: "signed-out" });
    await signOutAction();
  }

  return (
    <form action={signOut} className={styles.account}>
      <span aria-hidden="true" className={styles.initial}>
        {account.email.charAt(0).toUpperCase()}
      </span>
      <span className={styles.email}>{account.email}</span>
      <button type="submit" className={styles.textButton}>
        Sign out
      </button>
    </form>
  );
}
