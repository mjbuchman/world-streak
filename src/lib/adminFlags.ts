// The admin flags review (T124). Both database functions check that the caller is an admin, so
// these take the caller's own (cookie) client. Server only: zod must not ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import type { EditState } from "@/lib/adminEdit";
import { dbInteger, dbNumber } from "@/lib/db/numeric";

export type OpenFlag = { id: number; email: string; reason: string; createdAt: string; gameDate: string; score: number | null };

type FlagRow = { flag_id: unknown; email: string | null; reason: string; created_at: string; game_date: string; score: unknown };

/** Every open flag, oldest first. */
export async function readOpenFlags(db: Pick<SupabaseClient, "rpc">): Promise<OpenFlag[]> {
  const { data, error } = await db.rpc("admin_open_flags");
  if (error) throw new Error(`Flag lookup failed: ${error.message}`);
  return (data as FlagRow[]).map((row) => ({
    id: dbInteger(row.flag_id, "flag_id"),
    // A Google account always has one; kept readable if an account somehow has none.
    email: row.email ?? "(no email)",
    reason: row.reason,
    createdAt: row.created_at,
    gameDate: row.game_date,
    score: row.score === null ? null : dbNumber(row.score, "score"),
  }));
}

const reviewSchema = z.object({
  flagId: z.coerce.number().int().positive(),
  decision: z.enum(["dismissed", "confirmed"]),
});

const MESSAGES = {
  dismissed: "Flag dismissed.",
  confirmed: "Flag confirmed: the account stays out of the draw.",
} as const;

/** Dismisses or confirms one flag from the review form. */
export async function reviewFlag(db: Pick<SupabaseClient, "rpc">, form: FormData): Promise<EditState> {
  if (!(await isAdmin(db))) return { ok: false, message: "Only admins can review flags." };
  const parsed = reviewSchema.safeParse({ flagId: form.get("flagId") ?? "", decision: form.get("decision") });
  if (!parsed.success) return { ok: false, message: "Unknown flag or decision." };
  const { flagId, decision } = parsed.data;

  const { data, error } = await db.rpc("review_cheat_flag", { p_flag_id: flagId, p_decision: decision });
  if (error) throw new Error(`Reviewing the flag failed: ${error.message}`);
  if (data === "not-found") return { ok: false, message: "That flag is gone. Reload the page." };
  return { ok: true, message: MESSAGES[decision] };
}
