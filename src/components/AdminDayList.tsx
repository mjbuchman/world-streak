import type { AdminDay } from "@/lib/admin";
import { challengeName, dayLabel, passRateLabel } from "@/lib/streak/streak";
import styles from "./HistoryTable.module.css";

/** Today and the coming game days as an admin sees them: what each will ask, and whether it has closed. */
export function AdminDayList({ days }: { days: AdminDay[] }) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Challenge</th>
            <th scope="col">Pass target</th>
            <th scope="col">Needed</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.gameDate}>
              <th scope="row">{dayLabel(day.gameDate)}</th>
              <td>{challengeName(day.challengeType)}</td>
              <td>{day.passTarget}</td>
              <td>{passRateLabel(day.threshold)}</td>
              <td>{day.closed ? "Closed" : "Open"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
