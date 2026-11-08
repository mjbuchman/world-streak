"use server";

import { redirect } from "next/navigation";
import { eligibilityToday } from "@/lib/dates";
import { type CompleteProfileState, completeProfile } from "@/lib/profileCompletion";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Postgres unique violation: the profile already exists. */
const UNIQUE_VIOLATION = "23505";

export async function completeProfileAction(
  _previous: CompleteProfileState | null,
  formData: FormData,
): Promise<CompleteProfileState> {
  // getUser validates the session with Supabase: the profile is written for this exact user
  // with the service role, so a forged cookie must not get this far.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const result = await completeProfile(formData, {
    today: eligibilityToday(new Date()),
    async createProfile({ birthDate, country }) {
      const { error } = await createSupabaseAdminClient()
        .from("profiles")
        .insert({ id: user.id, birth_date: birthDate, country });
      // A repeated submit (for example from a second tab) finds the profile already there.
      return !error || error.code === UNIQUE_VIOLATION;
    },
  });

  if (result.ok) redirect("/");
  return result;
}
