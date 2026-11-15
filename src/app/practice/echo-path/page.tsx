import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { EchoPathPractice } from "./EchoPathPractice";

export const metadata: Metadata = { title: `Practice ${CHALLENGE_NAMES["echo-path"]}` };

/** Open to everyone, signed in or not; nothing here is sent to the server. */
export default function EchoPathPracticePage() {
  return (
    <PageShell title={`Practice: ${CHALLENGE_NAMES["echo-path"]}`} backHref="/">
      <EchoPathPractice />
    </PageShell>
  );
}
