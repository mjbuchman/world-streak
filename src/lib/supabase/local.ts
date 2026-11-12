/** Whether `url` points at the local Supabase: exactly localhost or 127.0.0.1, any port. */
export function isLocalSupabaseUrl(url: string | undefined): boolean {
  try {
    const { hostname } = new URL(url ?? "");
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}
