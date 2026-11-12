"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { saveGameDayEdit, type EditState } from "@/lib/adminEdit";
import { reviewFlag } from "@/lib/adminFlags";
import { saveGameSettings } from "@/lib/adminSettings";
import { drawCycle } from "@/lib/draw";
import { localToolsEnabled, runLocalTool, supabaseDevData, type ToolState } from "@/lib/localTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Saves one game day's edit as the signed-in caller; their admin status is checked again here. */
export async function saveGameDayAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await saveGameDayEdit(await createSupabaseServerClient(), form);
  if (state.ok) revalidatePath("/admin");
  return state;
}

/** Saves the game settings as the signed-in caller (T42); their admin status is checked again here. */
export async function saveSettingsAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await saveGameSettings(await createSupabaseServerClient(), form);
  if (state.ok) revalidatePath("/admin/settings");
  return state;
}

/** Dismisses or confirms one cheat flag as the signed-in caller (T124). */
export async function reviewFlagAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await reviewFlag(await createSupabaseServerClient(), form);
  if (state.ok) revalidatePath("/admin/flags");
  return state;
}

/** Draws one cycle's winner as the signed-in caller (T43), with a cryptographically random ticket. */
export async function drawCycleAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await drawCycle(await createSupabaseServerClient(), form, (max) => randomInt(max));
  if (state.ok) revalidatePath("/admin/draw");
  return state;
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
