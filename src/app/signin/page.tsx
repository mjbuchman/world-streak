import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form/FormParts";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { GAME_NAME } from "@/config/game";
import styles from "@/app/auth/authPage.module.css";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: `Sign in | ${GAME_NAME}` };

/** Set by /auth/callback when Google sign-in was cancelled or its code was rejected. */
const OAUTH_FAILED = "Google sign-in didn't complete. Please try again.";

type SignInPageProps = { searchParams: Promise<{ error?: string | string[] }> };

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Sign in</h1>
      {error === "oauth" && (
        <div className={styles.alert}>
          <FormAlert message={OAUTH_FAILED} />
        </div>
      )}
      <GoogleSignInButton />
      <p className={styles.divider}>or sign in with your email</p>
      <SignInForm />
      <p className={styles.switch}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
