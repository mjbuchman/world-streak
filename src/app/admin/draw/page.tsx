import type { Metadata } from "next";
import { DrawButton } from "@/components/DrawButton";
import { WinnerPayout } from "@/components/WinnerPayout";
import table from "@/components/ui/DataTable.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { STREAK_GOAL_DAYS } from "@/config/prize";
import { requireAdminPage } from "@/lib/adminPage";
import { canDraw, payoutDeadline, readDrawCycles, readWinners, type DrawCycle, type Winner } from "@/lib/draw";
import { gameDateAt } from "@/lib/gameDay";
import { dayLabel } from "@/lib/streak/streak";

export const metadata: Metadata = { title: `Prize draw | ${GAME_NAME}`, robots: { index: false } };

function notReadyReason(cycle: DrawCycle, today: string): string {
  if (cycle.drawnAt !== null) return "Drawn.";
  if (cycle.goalReachedOn === null) {
    return cycle.endDate < today ? `No ${STREAK_GOAL_DAYS}-day streak: the prize rolled over.` : "Goal not reached yet.";
  }
  return "Can be drawn after the cycle ends.";
}

function winnerCell(cycle: DrawCycle, winner: Winner | undefined) {
  if (!winner) return "None";
  return (
    <WinnerPayout
      winner={{
        cycle: cycle.number,
        email: winner.email,
        verified: winner.verified,
        deadline: dayLabel(payoutDeadline(cycle.endDate)),
        paidOn: cycle.paidOn && dayLabel(cycle.paidOn),
      }}
    />
  );
}

/** Every cycle with its goal, draw and payout status (T43, T125). A 404 for non-admins. */
export default async function DrawPage() {
  const db = await requireAdminPage();
  const [cycles, winners] = await Promise.all([readDrawCycles(db), readWinners(db)]);
  const today = gameDateAt(new Date());
  return (
    <PageShell title="Prize draw" backHref="/admin">
      <Surface as="section" aria-label="Cycles">
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th scope="col">Cycle</th>
                <th scope="col">Dates</th>
                <th scope="col">Goal reached</th>
                <th scope="col">Draw</th>
                <th scope="col">Winner</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.number}>
                  <th scope="row">{cycle.number}</th>
                  <td>{`${dayLabel(cycle.startDate)} to ${dayLabel(cycle.endDate)}`}</td>
                  <td>{cycle.goalReachedOn ? dayLabel(cycle.goalReachedOn) : "Not yet"}</td>
                  <td>
                    <DrawButton cycle={cycle.number} ready={canDraw(cycle, today)} reason={notReadyReason(cycle, today)} />
                  </td>
                  <td>{winnerCell(cycle, winners.get(cycle.number))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </PageShell>
  );
}
