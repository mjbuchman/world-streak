import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryTable } from "@/components/HistoryTable";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";
import { readHistory } from "@/lib/streak/streak";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Every day | ${GAME_NAME}` };

/** `?page=N` as a page number: anything but a positive whole number reads as the first page. */
function pageParam(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Every closed game day, newest first, 30 to a page. */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const page = pageParam((await searchParams).page);
  const history = await readHistory(await createSupabaseServerClient(), page);
  if (page > history.pageCount) notFound();
  return (
    <PageShell title="Every day" backHref="/">
      <Surface>
        <HistoryTable history={history} />
      </Surface>
    </PageShell>
  );
}
