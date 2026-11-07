import type { Metadata } from "next";
import { GAME_NAME } from "@/config/game";
import { eligibilitySummary } from "@/lib/eligibility";
import { SignUpForm } from "./SignUpForm";
import styles from "./signup.module.css";

export const metadata: Metadata = { title: `Create account | ${GAME_NAME}` };

export default function SignUpPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.intro}>
        An account lets your daily attempt count toward the world streak. Open to {eligibilitySummary()}.
      </p>
      <SignUpForm />
    </main>
  );
}
