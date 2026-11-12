import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DrawButton } from "@/components/DrawButton";
import table from "@/components/ui/DataTable.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { STREAK_GOAL_DAYS } from "@/config/prize";
import { isAdmin } from "@/lib/admin";
import { canDraw, readDrawCycles, type DrawCycle } from "@/lib/draw";
import { gameDateAt } from "@/lib/gameDay";
import { dayLabel } from "@/lib/streak/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Prize draw | ${GAME_NAME}`, robots: { index: false } };

function notReadyReason(cycle: DrawCycle, today: string): string {
  if (cycle.drawnAt !== null) return "Drawn.";
  if (cycle.goalReachedOn === null) {
    return cycle.endDate < today ? `No ${STREAK_GOAL_DAYS}-day streak: the prize rolled over.` : "Goal not reached yet.";
  }
  return "Can be drawn after the cycle ends.";
}

/** Every cycle with its goal and draw status, and the Draw button (T43). A 404 for non-admins. */
export default async function DrawPage() {
  const db = await createSupabaseServerClient();
  if (!(await isAdmin(db))) notFound();
  const cycles = await readDrawCycles(db);
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </PageShell>
  );
}
