import Link from "next/link";
import { challengeName, dayLabel, passRateLabel, type HistoryPage } from "@/lib/streak/streak";
import styles from "./HistoryTable.module.css";

const OUTCOME_LABELS = { survived: "Survived", broken: "Broke" } as const;

/** Closed game days, newest first, with links to the newer and older pages. */
export function HistoryTable({ history }: { history: HistoryPage }) {
  const { days, page, pageCount } = history;
  if (days.length === 0) return <p className={styles.empty}>No game day has closed yet.</p>;
  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Challenge</th>
              <th scope="col">Passing</th>
              <th scope="col">Needed</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.gameDate}>
                <th scope="row">{dayLabel(day.gameDate)}</th>
                <td>{challengeName(day.challengeType)}</td>
                <td>{passRateLabel(day.finalPassRate)}</td>
                <td>{passRateLabel(day.threshold)}</td>
                <td className={styles[day.outcome]}>{OUTCOME_LABELS[day.outcome]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav aria-label="History pages" className={styles.pages}>
          {page > 1 && <Link href={page === 2 ? "/history" : `/history?page=${page - 1}`}>Newer days</Link>}
          <span>
            Page {page} of {pageCount}
          </span>
          {page < pageCount && <Link href={`/history?page=${page + 1}`}>Older days</Link>}
        </nav>
      )}
    </>
  );
}
