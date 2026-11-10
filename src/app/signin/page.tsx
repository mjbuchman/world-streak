import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form/FormParts";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
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
    <PageShell title="Sign in" backHref="/">
      {error === "oauth" && <FormAlert message={OAUTH_FAILED} />}
      <Surface>
        <GoogleSignInButton />
        <p className={styles.divider}>or use your email</p>
        <SignInForm />
      </Surface>
      <p className={styles.switch}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </PageShell>
  );
}
