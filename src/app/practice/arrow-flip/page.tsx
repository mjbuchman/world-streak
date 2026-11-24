import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { ARROW_FLIP } from "@/config/newGames";
import { ArrowFlipPractice } from "./ArrowFlipPractice";

export const metadata: Metadata = { title: `Practice ${ARROW_FLIP.name}` };

/** Practice only for now (T246): open to everyone, nothing sent to the server, not in the daily pool. */
export default function ArrowFlipPracticePage() {
  return (
    <PageShell title={`Practice: ${ARROW_FLIP.name}`} backHref="/">
      <ArrowFlipPractice />
    </PageShell>
  );
}
