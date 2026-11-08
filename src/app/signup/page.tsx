import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { GAME_NAME } from "@/config/game";
import { eligibilitySummary } from "@/lib/eligibility";
import { SignUpForm } from "./SignUpForm";
import styles from "@/app/auth/authPage.module.css";

export const metadata: Metadata = { title: `Create account | ${GAME_NAME}` };

export default function SignUpPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.intro}>
        An account lets your daily attempt count toward the world streak. Open to {eligibilitySummary()}.
      </p>
      <GoogleSignInButton />
      <p className={styles.divider}>or create an account with your email</p>
      <SignUpForm />
      <p className={styles.switch}>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </main>
  );
}
