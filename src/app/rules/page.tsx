import type { Metadata } from "next";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { GAME_NAME } from "@/config/game";

export const metadata: Metadata = { title: `Official rules | ${GAME_NAME}` };

// Placeholder until the draft official rules are written (backlog T38).
export default function RulesPage() {
  return (
    <PageShell title="Official rules" backHref="/">
      <Surface>
        <p>The official rules are being written and will appear here before launch.</p>
      </Surface>
    </PageShell>
  );
}
