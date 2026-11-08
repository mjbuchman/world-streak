import { type NextRequest, NextResponse } from "next/server";
import { landingPath } from "@/lib/profiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public by design: this is where Google sign-in returns, before there is a session. The only
// input is the one-time code, which Supabase validates against the PKCE verifier cookie.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { origin, searchParams } = request.nextUrl;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  // No code means the player cancelled or Google returned an error.
  const code = searchParams.get("code");
  if (!code) return go("/signin?error=oauth");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return go("/signin?error=oauth");

  return go(await landingPath(supabase, data.user.id));
}
