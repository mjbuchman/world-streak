import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { INK } from "@/config/newGames";
import { InkPractice } from "./InkPractice";

export const metadata: Metadata = { title: `Practice ${INK.name}` };

/** Practice only for now (T252): open to everyone, nothing sent to the server, not in the daily pool. */
export default function InkPracticePage() {
  return (
    <PageShell title={`Practice: ${INK.name}`} backHref="/">
      <InkPractice />
    </PageShell>
  );
}
