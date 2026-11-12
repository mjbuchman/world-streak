// The one gate for the admin pages (T127): the signed-in admin's own client, or a 404 for anyone
// else, so non-admins cannot even tell the pages exist. Actions re-check in their lib functions.
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdminPage() {
  const db = await createSupabaseServerClient();
  if (!(await isAdmin(db))) notFound();
  return db;
}
