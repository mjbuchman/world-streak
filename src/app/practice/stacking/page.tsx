import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import { StackingPractice } from "./StackingPractice";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES.stacking} | ${GAME_NAME}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function StackingPracticePage() {
  return (
    <PageShell title={`Practice: ${CHALLENGE_NAMES.stacking}`} backHref="/">
      <StackingPractice />
    </PageShell>
  );
}
