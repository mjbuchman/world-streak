"use server";

import { revalidatePath } from "next/cache";
import { saveGameDayEdit, type EditState } from "@/lib/adminEdit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Saves one game day's edit as the signed-in caller; their admin status is checked again here. */
export async function saveGameDayAction(_previous: EditState | null, form: FormData): Promise<EditState> {
  const state = await saveGameDayEdit(await createSupabaseServerClient(), form);
  if (state.ok) revalidatePath("/admin");
  return state;
}
