import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { RulesContent } from "@/components/RulesContent";
import { PageShell } from "@/components/ui/PageShell";
import { RULES_CONFIG } from "@/lib/rules";

export const metadata: Metadata = { title: "Official rules" };

export default function RulesPage() {
  return (
    <PageShell title="Official rules" backHref="/">
      <RulesContent config={RULES_CONFIG} />
      <AdSlot name="rules" />
    </PageShell>
  );
}
