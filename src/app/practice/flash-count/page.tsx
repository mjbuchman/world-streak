import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import { FlashCountPractice } from "./FlashCountPractice";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES["flash-count"]} | ${GAME_NAME}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function FlashCountPracticePage() {
  return (
    <PageShell title={`Practice: ${CHALLENGE_NAMES["flash-count"]}`} backHref="/">
      <FlashCountPractice />
    </PageShell>
  );
}
