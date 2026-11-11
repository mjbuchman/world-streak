import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const saveGameDayEdit = vi.hoisted(() => vi.fn<(db: unknown, form: FormData) => Promise<EditState>>());
const revalidatePath = vi.hoisted(() => vi.fn());
const sessionClient = vi.hoisted(() => ({ kind: "session" }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => sessionClient) }));
vi.mock("@/lib/adminEdit", () => ({ saveGameDayEdit }));

import { saveGameDayAction } from "./actions";

afterEach(() => vi.clearAllMocks());

describe("saveGameDayAction", () => {
  it("saves as the signed-in caller and refreshes /admin", async () => {
    saveGameDayEdit.mockResolvedValue({ ok: true, message: "Saved Nov 12, 2026." });
    const form = new FormData();
    expect(await saveGameDayAction(null, form)).toEqual({ ok: true, message: "Saved Nov 12, 2026." });
    expect(saveGameDayEdit).toHaveBeenCalledWith(sessionClient, form);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("passes a refusal on without refreshing", async () => {
    saveGameDayEdit.mockResolvedValue({ ok: false, message: "Only admins can edit game days." });
    expect(await saveGameDayAction(null, new FormData())).toEqual({ ok: false, message: "Only admins can edit game days." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
