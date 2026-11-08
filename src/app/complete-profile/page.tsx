import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GAME_NAME } from "@/config/game";
import { eligibilitySummary } from "@/lib/eligibility";
import { landingPath } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/app/auth/authPage.module.css";
import { CompleteProfileForm } from "./CompleteProfileForm";

export const metadata: Metadata = { title: `Finish setting up | ${GAME_NAME}` };

/** For signed-in players without a profile, usually after their first Google sign-in. */
export default async function CompleteProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/signin");
  if ((await landingPath(supabase, userId)) === "/") redirect("/");

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Finish setting up your account</h1>
      <p className={styles.intro}>
        We need a few details before your daily attempt can count. Open to {eligibilitySummary()}.
      </p>
      <CompleteProfileForm />
    </main>
  );
}
