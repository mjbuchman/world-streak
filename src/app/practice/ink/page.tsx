import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { InkPractice } from "./InkPractice";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES.ink}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function InkPracticePage() {
  return (
    <PageShell title={`Practice: ${CHALLENGE_NAMES.ink}`} backHref="/">
      <InkPractice />
    </PageShell>
  );
}
