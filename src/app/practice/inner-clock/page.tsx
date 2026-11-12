import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { InnerClockPractice } from "./InnerClockPractice";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES["inner-clock"]}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function InnerClockPracticePage() {
  return (
    <PageShell title={`Practice: ${CHALLENGE_NAMES["inner-clock"]}`} backHref="/">
      <InnerClockPractice />
    </PageShell>
  );
}
