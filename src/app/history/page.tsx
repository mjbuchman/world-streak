import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryTable } from "@/components/HistoryTable";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { historyPageParam, readHistory } from "@/lib/streak/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Every day | ${GAME_NAME}` };

/** Every closed game day, newest first, 30 to a page. A page past the last is a 404. */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = historyPageParam((await searchParams).page);
  const history = await readHistory(await createSupabaseServerClient(), page);
  if (!history || page > history.pageCount) notFound();
  return (
    <PageShell title="Every day" backHref="/">
      <Surface>
        <HistoryTable history={history} />
      </Surface>
    </PageShell>
  );
}
