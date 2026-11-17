import { GameDayEditRow } from "@/components/GameDayEditRow";
import table from "@/components/ui/DataTable.module.css";
import { CHALLENGE_NAMES } from "@/config/challenges";
import type { AdminDay } from "@/lib/admin";
import { dayLabel, passRateLabel } from "@/lib/streak/streak";
import styles from "./AdminDayList.module.css";

/** A fraction as an editable percent, without float noise (0.55 is 55, not 55.00000000000001). */
const asPercent = (fraction: number) => Math.round(fraction * 10_000) / 100;

/**
 * Today and the coming game days as an admin sees them: each day's three games in order with
 * their pass targets (T161). Open days can be edited; a closed day is read-only. The labels are
 * worked out here, on the server, so the edit rows stay plain.
 */
export function AdminDayList({ days }: { days: AdminDay[] }) {
  return (
    <div className={table.scroll}>
      <table className={table.table}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Games and pass targets</th>
            <th scope="col">Survival threshold (%)</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const label = dayLabel(day.gameDate);
            if (!day.closed) {
              return (
                <GameDayEditRow
                  key={day.gameDate}
                  day={{ gameDate: day.gameDate, label, games: day.games, thresholdPercent: asPercent(day.threshold), started: day.started }}
                />
              );
            }
            return (
              <tr key={day.gameDate}>
                <th scope="row">{label}</th>
                <td>
                  <ol className={styles.games}>
                    {day.games.map((game) => (
                      <li key={game.position}>
                        {CHALLENGE_NAMES[game.challengeType]}, target {game.passTarget}
                      </li>
                    ))}
                  </ol>
                </td>
                <td>{passRateLabel(day.threshold)}</td>
                <td>Closed</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
