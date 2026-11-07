import type { Metadata } from "next";
import Link from "next/link";
import { GAME_NAME } from "@/config/game";
import styles from "../signup/signup.module.css";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: `Sign in | ${GAME_NAME}` };

export default function SignInPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Sign in</h1>
      <SignInForm />
      <p className={styles.switch}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
