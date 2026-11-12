"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { saveGameDayEdit } from "@/lib/adminEdit";
import { reviewFlag } from "@/lib/adminFlags";
import type { EditState } from "@/lib/adminForm";
import { saveGameSettings } from "@/lib/adminSettings";
import { drawCycle, markPaid } from "@/lib/draw";
import { localToolsEnabled, runLocalTool, supabaseDevData, type ToolState } from "@/lib/localTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CallerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Runs one admin save with the signed-in caller's own client (so row-level security and the admin
 * check apply to them) and refreshes `path` only when the save succeeded.
 */
async function adminAction(path: string, save: (db: CallerClient) => Promise<EditState>): Promise<EditState> {
  const state = await save(await createSupabaseServerClient());
  if (state.ok) revalidatePath(path);
  return state;
}

/** Saves one game day's edit as the signed-in caller; their admin status is checked again here. */
export async function saveGameDayAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  return adminAction("/admin", (db) => saveGameDayEdit(db, form));
}

/** Saves the game settings as the signed-in caller (T42); their admin status is checked again here. */
export async function saveSettingsAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  return adminAction("/admin/settings", (db) => saveGameSettings(db, form));
}

/** Dismisses or confirms one cheat flag as the signed-in caller (T124). */
export async function reviewFlagAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  return adminAction("/admin/flags", (db) => reviewFlag(db, form));
}

/** Draws one cycle's winner as the signed-in caller (T43), with a cryptographically random ticket. */
export async function drawCycleAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  return adminAction("/admin/draw", (db) => drawCycle(db, form, (max) => randomInt(max)));
}

/** Marks a drawn cycle's prize paid, as the signed-in caller (T125). */
export async function markPaidAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  return adminAction("/admin/draw", (db) => markPaid(db, form));
}

/** Runs one local tool (T116). The local and admin checks run again inside, before any change. */
export async function localToolAction(_previous: ToolState | null, form: FormData): Promise<ToolState> {
  // Checked before the service-role client is even made.
  if (!localToolsEnabled()) return { ok: false, message: "Local tools work only with the local Supabase." };
  const service = createSupabaseAdminClient();
  const state = await runLocalTool(await createSupabaseServerClient(), service, form, new Date(), supabaseDevData(service));
  if (state.ok) revalidatePath("/admin");
  return state;
}
