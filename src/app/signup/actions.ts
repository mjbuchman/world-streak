"use server";

import { redirect } from "next/navigation";
import { eligibilityToday } from "@/lib/dates";
import { type SignUpState, signUp } from "@/lib/signup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public by design: this action creates the account, so there is no session to check yet.
// All input is validated by signUp before anything is written.
export async function signUpAction(_previous: SignUpState | null, formData: FormData): Promise<SignUpState> {
  // Created on first use, so invalid submissions never depend on server configuration.
  let adminClient: ReturnType<typeof createSupabaseAdminClient> | undefined;
  const admin = () => (adminClient ??= createSupabaseAdminClient());

  const result = await signUp(formData, {
    today: eligibilityToday(new Date()),
    async createUser(email, password) {
      // email_confirm: email confirmation is off for the MVP (DESIGN.md, Auth).
      const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return { error: error?.code === "email_exists" ? "email-taken" : "unknown" };
      return { userId: data.user.id };
    },
    async createProfile({ userId, birthDate, country }) {
      const { error } = await admin().from("profiles").insert({ id: userId, birth_date: birthDate, country });
      return !error;
    },
    async deleteUser(userId) {
      const { error } = await admin().auth.admin.deleteUser(userId);
      // An account without a profile must not linger silently; log it for manual clean-up.
      if (error) console.error(`Sign-up clean-up failed: could not delete auth user ${userId}`, error.message);
    },
    async signIn(email, password) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    },
  });

  if (result.ok) redirect("/");
  return result;
}
