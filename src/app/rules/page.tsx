import type { Metadata } from "next";
import { RulesContent } from "@/components/RulesContent";
import { PageShell } from "@/components/ui/PageShell";
import { GAME_NAME } from "@/config/game";
import { RULES_CONFIG } from "@/lib/rules";

export const metadata: Metadata = { title: `Official rules | ${GAME_NAME}` };

export default function RulesPage() {
  return (
    <PageShell title="Official rules" backHref="/">
      <RulesContent config={RULES_CONFIG} />
    </PageShell>
  );
}
