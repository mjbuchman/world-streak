import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, requireEnv } from "./env";

/**
 * Service-role client that bypasses row-level security. Server code only (enforced by
 * `server-only`); use it for trusted work such as scoring, never with user-chosen queries.
 */
export function createSupabaseAdminClient() {
  const { url } = publicSupabaseEnv();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
