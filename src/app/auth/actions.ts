"use server";

import { redirect } from "next/navigation";
import { landingPath } from "@/lib/profiles";
import { type SignInState, signIn } from "@/lib/signin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public by design: signing in is how a session starts. Input is validated by signIn.
export async function signInAction(_previous: SignInState | null, formData: FormData): Promise<SignInState> {
  const supabase = await createSupabaseServerClient();
  let userId: string | undefined;
  const result = await signIn(formData, {
    async authenticate(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        userId = data.user?.id;
        return "ok";
      }
      // Supabase uses one code for an unknown email and a wrong password, so this still
      // never reveals whether an account exists. It checks the password before confirmation.
      if (error.code === "invalid_credentials") return "invalid-credentials";
      return error.code === "email_not_confirmed" ? "email-not-confirmed" : "error";
    },
  });
  if (result.ok) redirect(userId ? await landingPath(supabase, userId) : "/");
  return result;
}

// Signing out without a session is harmless, so no auth check is needed. "local" signs out
// this browser only; a player's other devices stay signed in.
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
