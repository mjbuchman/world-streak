import type { Metadata } from "next";
import { MIN_AGE } from "@/config/eligibility";
import { GAME_NAME } from "@/config/game";
import { SignUpForm } from "./SignUpForm";
import styles from "./signup.module.css";

export const metadata: Metadata = { title: `Create account | ${GAME_NAME}` };

export default function SignUpPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.intro}>
        An account lets your daily attempt count toward the world streak. Open to US residents aged {MIN_AGE} or
        over.
      </p>
      <SignUpForm />
    </main>
  );
}
