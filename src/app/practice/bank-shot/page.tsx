import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { BANK_SHOT } from "@/config/newGames";
import { BankShotPractice } from "./BankShotPractice";

const BANK_SHOT_NAME = BANK_SHOT.name;
export const metadata: Metadata = { title: `Practice ${BANK_SHOT_NAME}` };

/** Practice only for now (T245): open to everyone, nothing sent to the server, not in the daily pool. */
export default function BankShotPracticePage() {
  return (
    <PageShell title={`Practice: ${BANK_SHOT_NAME}`} backHref="/">
      <BankShotPractice />
    </PageShell>
  );
}
