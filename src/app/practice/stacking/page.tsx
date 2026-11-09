import type { Metadata } from "next";
import { GAME_NAME } from "@/config/game";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { StackingPractice } from "./StackingPractice";
import styles from "./practice.module.css";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES.stacking.toLowerCase()} | ${GAME_NAME}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function StackingPracticePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Practice: {CHALLENGE_NAMES.stacking}</h1>
      <StackingPractice />
    </main>
  );
}
