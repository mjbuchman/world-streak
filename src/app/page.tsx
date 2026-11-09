import Link from "next/link";
import { GAME_NAME, GAME_PITCH } from "@/config/game";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{GAME_NAME}</h1>
      <p className={styles.pitch}>{GAME_PITCH}</p>
      <div className={styles.actions}>
        <Link href="/play" className={styles.play}>
          Play today&apos;s challenge
        </Link>
        <Link href="/practice/stacking" className={styles.link}>
          Practice
        </Link>
      </div>
    </main>
  );
}
