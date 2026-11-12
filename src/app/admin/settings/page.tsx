import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { SettingsForm } from "@/components/SettingsForm";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { GAME_NAME } from "@/config/game";
import { isAdmin } from "@/lib/admin";
import { readSettingsForm, SETTINGS_FIELDS } from "@/lib/adminSettings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Settings | ${GAME_NAME}`, robots: { index: false } };

/** The game settings editor (T42). Like /admin, anyone but a signed-in admin gets a 404. */
export default async function SettingsPage() {
  const db = await createSupabaseServerClient();
  if (!(await isAdmin(db))) notFound();
  const values = await readSettingsForm(db);
  const fields = [
    ...SETTINGS_FIELDS.map(({ name, label, hint }) => ({ name, label, hint })),
    ...CHALLENGE_TYPES.map((type) => ({
      name: `target-${type}`,
      label: `${CHALLENGE_NAMES[type]} default pass target`,
      hint: "Used until there are enough recent scores for this challenge.",
    })),
    { name: "rotation", label: "Rotation", hint: `Challenges in daily order, separated by commas: ${CHALLENGE_TYPES.join(", ")}.` },
  ];
  return (
    <PageShell title="Settings" backHref="/admin">
      <Surface>
        <SettingsForm fields={fields} values={values} />
      </Surface>
    </PageShell>
  );
}
