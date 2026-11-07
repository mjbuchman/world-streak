import { GAME_NAME } from "@/config/game";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{GAME_NAME}</h1>
      <p className={styles.status}>Today&apos;s challenge isn&apos;t open yet.</p>
    </main>
  );
}
