import type { Metadata } from "next";
import Link from "next/link";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES, CHALLENGE_TAGLINES, practicePath } from "@/config/challenges";
import styles from "./hub.module.css";

export const metadata: Metadata = { title: "Practice" };

/** Every challenge, to practise any of them at any time (T108). Open to everyone. */
export default function PracticeHub() {
  return (
    <PageShell title="Practice" backHref="/">
      <p className={styles.intro}>Practice never counts. Play any challenge as often as you like.</p>
      <ul className={styles.list} aria-label="Challenges">
        {CHALLENGE_TYPES.map((type) => (
          <li key={type}>
            <Surface>
              <Link href={practicePath(type)} className={styles.name}>
                {CHALLENGE_NAMES[type]}
              </Link>
              <p className={styles.tagline}>{CHALLENGE_TAGLINES[type]}</p>
            </Surface>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
