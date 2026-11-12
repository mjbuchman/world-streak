import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { optionalPublicSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie on every request (the @supabase/ssr proxy pattern).
 * Server Components cannot write cookies, so an expiring access token is renewed here and the
 * new cookies are passed both to the page being rendered and back to the browser.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  // Without configuration there is no session to refresh. Pages still fail loudly when they
  // need Supabase, but /api/health must keep answering so it can report "unavailable".
  const env = optionalPublicSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // No-cache headers from @supabase/ssr: a CDN must never cache a response carrying one
        // player's refreshed session cookie and serve it to someone else.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // getClaims() triggers the refresh when needed and, with asymmetric signing keys, verifies the
  // token locally; getUser() would cost an Auth round trip on every request (T58).
  await supabase.auth.getClaims();
  return response;
}
