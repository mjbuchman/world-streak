import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers. It reads the
 * session from the request cookies, so it acts as the signed-in user under row-level security.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies. The session is refreshed where cookies are
          // writable (Route Handlers and Server Actions), so skipping the write here is safe.
        }
      },
    },
  });
}
