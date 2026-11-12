/**
 * The one local-only toolkit for the dev scripts (`seed:dev`, `test:e2e:local`, and later
 * `close-day` and `simulate:days`): they create, change or delete data, so they must never reach
 * a real project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// Shared with the admin page's local tools (T116), so both use one guard.
import { isLocalSupabaseUrl } from "../../src/lib/supabase/local.ts";

export { isLocalSupabaseUrl };

/**
 * Throws unless `url` is local. `purpose` and `setting` name what is refused and where the URL
 * came from, for example ("seed", "NEXT_PUBLIC_SUPABASE_URL").
 */
export function assertLocalSupabaseUrl(url: string | undefined, purpose: string, setting: string): asserts url is string {
  if (!isLocalSupabaseUrl(url)) {
    throw new Error(`Refusing to ${purpose}: ${setting} must be localhost or 127.0.0.1 (local Supabase), not "${url ?? ""}".`);
  }
}

/** A service-role client that never keeps or refreshes a session. */
export function createServiceClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export { check } from "../../src/lib/devData.ts";
