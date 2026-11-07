"use server";

import { redirect } from "next/navigation";
import { type SignInState, signIn } from "@/lib/signin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public by design: signing in is how a session starts. Input is validated by signIn.
export async function signInAction(_previous: SignInState | null, formData: FormData): Promise<SignInState> {
  const result = await signIn(formData, {
    async authenticate(email, password) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return !error;
    },
  });
  if (result.ok) redirect("/");
  return result;
}

// Signing out without a session is harmless, so no auth check is needed.
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
