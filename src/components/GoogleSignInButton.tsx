"use client";

import { useState } from "react";
import { FormAlert } from "@/components/form/FormParts";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./GoogleSignInButton.module.css";

const START_FAILED = "Google sign-in didn't start. Please try again.";

/**
 * Material 3 outlined button that sends the player to Google. Google returns them to
 * /auth/callback, which finishes sign-in and asks for a profile if they have none yet.
 */
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    setPending(true);
    setError(undefined);
    const { error: failed } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser is already leaving for Google, so stay disabled.
    if (failed) {
      setError(START_FAILED);
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <FormAlert message={error} />
      <button type="button" onClick={start} disabled={pending} className={styles.button}>
        Continue with Google
      </button>
    </div>
  );
}
