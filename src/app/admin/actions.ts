"use server";

import { revalidatePath } from "next/cache";
import { saveGameDayEdit, type EditState } from "@/lib/adminEdit";
import { localToolsEnabled, runLocalTool, supabaseDevData, type ToolState } from "@/lib/localTools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Saves one game day's edit as the signed-in caller; their admin status is checked again here. */
export async function saveGameDayAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await saveGameDayEdit(await createSupabaseServerClient(), form);
  if (state.ok) revalidatePath("/admin");
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
