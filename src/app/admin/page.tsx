import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminDayList } from "@/components/AdminDayList";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { isAdmin, readAdminDays } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Admin | ${GAME_NAME}`, robots: { index: false } };

/**
 * The admin page. Anyone who is not a signed-in admin gets the same 404 as a page that does not
 * exist, so the page does not reveal itself. The check runs on the server for every request.
 */
export default async function AdminPage() {
  if (!(await isAdmin(await createSupabaseServerClient()))) notFound();
  const days = await readAdminDays(createSupabaseAdminClient(), new Date());
  return (
    <PageShell title="Admin" backHref="/">
      <Surface as="section" aria-label="Coming game days">
        <AdminDayList days={days} />
      </Surface>
    </PageShell>
  );
}
