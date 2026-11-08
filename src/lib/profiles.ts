import type { SupabaseClient } from "@supabase/supabase-js";

/** Any Supabase client that can read the player's own profile (the server client, under RLS). */
export type ProfileReader = Pick<SupabaseClient, "from">;

export type LandingPath = "/" | "/complete-profile";

/**
 * Where a player goes after signing in: players without a profile (for example after their
 * first Google sign-in) must give their eligibility details first. A failed lookup sends them
 * home rather than asking again for details they may have given; scored attempts check for a
 * profile on the server regardless (T12).
 */
export async function landingPath(supabase: ProfileReader, userId: string): Promise<LandingPath> {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) return "/";
  return data ? "/" : "/complete-profile";
}
