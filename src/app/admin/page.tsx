import type { Metadata } from "next";
import Link from "next/link";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { AdminDayList } from "@/components/AdminDayList";
import { LocalTools } from "@/components/LocalTools";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { readAdminDays } from "@/lib/admin";
import { requireAdminPage } from "@/lib/adminPage";
import { addDays, gameDateAt } from "@/lib/gameDay";
import { localToolsEnabled, MAX_SEED_PLAYERS } from "@/lib/localTools";
import { dayLabel } from "@/lib/streak/streak";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

/**
 * The admin page. Anyone who is not a signed-in admin gets the same 404 as a page that does not
 * exist, so the page does not reveal itself. The check runs on the server for every request.
 */
export default async function AdminPage() {
  await requireAdminPage();
  const now = new Date();
  const days = await readAdminDays(createSupabaseAdminClient(), now);
  return (
    <PageShell title="Admin" backHref="/">
      <nav aria-label="Admin pages">
        <Link href="/admin/settings">Game settings</Link> · <Link href="/admin/flags">Cheat flags</Link> · <Link href="/admin/draw">Prize draw</Link>
      </nav>
      <Surface as="section" aria-label="Coming game days">
        <AdminDayList days={days} />
      </Surface>
      {localToolsEnabled() && (
        <Surface as="section" aria-label="Local tools">
          <h2>Local tools</h2>
          <LocalTools
            days={days.filter((day) => !day.closed).map((day) => ({ gameDate: day.gameDate, label: dayLabel(day.gameDate) }))}
            challenges={CHALLENGE_TYPES.map((type) => ({ type, name: CHALLENGE_NAMES[type] }))}
            yesterday={addDays(gameDateAt(now), -1)}
            maxPlayers={MAX_SEED_PLAYERS}
          />
        </Surface>
      )}
    </PageShell>
  );
}
