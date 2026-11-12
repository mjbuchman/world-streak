import type { Metadata } from "next";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { eligibilitySummary } from "@/lib/eligibility";
import { SignUpForm } from "./SignUpForm";
import styles from "@/app/auth/authPage.module.css";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <PageShell title="Create account" backHref="/">
      <p className={styles.intro}>
        An account lets your daily attempt count toward the world streak. Open to {eligibilitySummary()}.
      </p>
      <Surface>
        <GoogleSignInButton />
        <p className={styles.divider}>or use your email</p>
        <SignUpForm />
      </Surface>
      <p className={styles.switch}>
        Already have an account? <Link href="/signin">Sign in</Link>
      </p>
    </PageShell>
  );
}
