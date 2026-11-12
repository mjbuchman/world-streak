import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/PageShell";
import { Surface } from "@/components/ui/Surface";
import { eligibilitySummary } from "@/lib/eligibility";
import { landingPath } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/auth/authPage.module.css";
import { CompleteProfileForm } from "./CompleteProfileForm";

export const metadata: Metadata = { title: "Finish setting up" };

/** For signed-in players without a profile, usually after their first Google sign-in. */
export default async function CompleteProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/signin");
  if ((await landingPath(supabase, userId)) === "/") redirect("/");

  return (
    <PageShell title="Finish setting up your account" backHref="/">
      <p className={styles.intro}>
        We need a few details before your daily attempt can count. Open to {eligibilitySummary()}.
      </p>
      <Surface>
        <CompleteProfileForm />
      </Surface>
    </PageShell>
  );
}
