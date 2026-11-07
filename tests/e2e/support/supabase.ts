import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Service-role client for checking and cleaning up what the app wrote. The keys come from the
 * environment (exported from `supabase status`, as in CI); e2e tests only ever run locally.
 */
export function adminClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Export the local Supabase keys before running e2e tests (see README).");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Finds an auth user by email, paging through all users (the admin API has no email filter). */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await adminClient().auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email === email);
    if (match || data.users.length < perPage) return match;
  }
}

/** Deletes the auth users with these emails (their profiles cascade). Missing users are skipped. */
export async function deleteUsersByEmail(emails: readonly string[]): Promise<void> {
  for (const email of emails) {
    const user = await findUserByEmail(email);
    if (user) await adminClient().auth.admin.deleteUser(user.id);
  }
}
