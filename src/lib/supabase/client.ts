import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

/** Supabase client for Client Components. Acts as the signed-in user, limited by row-level security. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
