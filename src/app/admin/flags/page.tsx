import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlagReviewRow } from "@/components/FlagReviewRow";
import table from "@/components/ui/DataTable.module.css";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { isAdmin } from "@/lib/admin";
import { readOpenFlags } from "@/lib/adminFlags";
import { dayLabel } from "@/lib/streak/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Flags | ${GAME_NAME}`, robots: { index: false } };

const flaggedAt = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Open cheat flags for an admin to dismiss or confirm (T124). Anyone else gets a 404. */
export default async function FlagsPage() {
  const db = await createSupabaseServerClient();
  if (!(await isAdmin(db))) notFound();
  const flags = await readOpenFlags(db);
  return (
    <PageShell title="Cheat flags" backHref="/admin">
      <Surface as="section" aria-label="Open flags">
        {flags.length === 0 ? (
          <p>No open flags.</p>
        ) : (
          <div className={table.scroll}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Flagged (UTC)</th>
                  <th scope="col">Game day</th>
                  <th scope="col">Score</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <FlagReviewRow
                    key={flag.id}
                    flag={{
                      id: flag.id,
                      email: flag.email,
                      reason: flag.reason,
                      flagged: flaggedAt(flag.createdAt),
                      day: dayLabel(flag.gameDate),
                      score: flag.score === null ? "None" : String(flag.score),
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </PageShell>
  );
}
