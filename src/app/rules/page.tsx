import type { Metadata } from "next";
import { GAME_NAME } from "@/config/game";
import styles from "../page.module.css";

export const metadata: Metadata = { title: `Official rules | ${GAME_NAME}` };

// Placeholder until the draft official rules are written (backlog T38).
export default function RulesPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Official rules</h1>
      <p className={styles.status}>The official rules are being written and will appear here before launch.</p>
    </main>
  );
}
