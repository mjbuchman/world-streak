/**
 * The one local-only toolkit for the dev scripts (`seed:dev`, `test:e2e:local`, and later
 * `close-day` and `simulate:days`): they create, change or delete data, so they must never reach
 * a real project.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Whether `url` points at the local Supabase: exactly localhost or 127.0.0.1, any port. */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  try {
    const { hostname } = new URL(url ?? "");
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

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

/** The data of a Supabase reply, or a throw naming the step that failed. */
export function check<T>(operation: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${operation} failed: ${result.error.message}`);
  return result.data;
}
