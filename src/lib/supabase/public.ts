import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "./env";

/**
 * An anonymous client with no session and no cookies: it reads only what row-level security
 * gives everyone. Use it for public, cacheable responses, which must never carry a player's
 * session or refreshed cookies.
 */
export function createSupabasePublicClient() {
  const { url, anonKey } = publicSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
