"use client";

import { useState } from "react";
import { FormAlert } from "@/components/form/FormParts";
import { Button } from "@/components/ui/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./GoogleSignInButton.module.css";

const START_FAILED = "Google sign-in didn't start. Please try again.";

/**
 * The secondary button that sends the player to Google. Google returns them to
 * /auth/callback, which finishes sign-in and asks for a profile if they have none yet.
 */
export function GoogleSignInButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    setPending(true);
    setError(undefined);
    let failed = true;
    try {
      const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      failed = Boolean(error);
    } catch {
      // A network or storage failure throws instead of returning an error; treat it the same.
    }
    // On success the browser is already leaving for Google, so stay busy.
    if (failed) {
      setError(START_FAILED);
      setPending(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <FormAlert message={error} />
      <Button variant="secondary" onClick={start} loading={pending}>
        Continue with Google
      </Button>
    </div>
  );
}
