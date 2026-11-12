import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";
import type { ToolState } from "@/lib/localTools";

const saveGameDayEdit = vi.hoisted(() => vi.fn<(db: unknown, form: FormData) => Promise<EditState>>());
const runLocalTool = vi.hoisted(() =>
  vi.fn<(caller: unknown, db: unknown, form: FormData, now: Date, data: unknown) => Promise<ToolState>>(),
);
const devData = vi.hoisted(() => ({ kind: "dev data" }));
const supabaseDevData = vi.hoisted(() => vi.fn(() => devData));
const localToolsEnabled = vi.hoisted(() => vi.fn(() => true));
const createSupabaseAdminClient = vi.hoisted(() => vi.fn(() => serviceClient));
const revalidatePath = vi.hoisted(() => vi.fn());
const sessionClient = vi.hoisted(() => ({ kind: "session" }));
const serviceClient = vi.hoisted(() => ({ kind: "service" }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => sessionClient) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));
vi.mock("@/lib/adminEdit", () => ({ saveGameDayEdit }));
vi.mock("@/lib/localTools", () => ({ localToolsEnabled, runLocalTool, supabaseDevData }));

import { localToolAction, saveGameDayAction } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
  localToolsEnabled.mockReturnValue(true);
});

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

describe("localToolAction", () => {
  it("runs the tool with the caller's client and the service role, then refreshes /admin", async () => {
    runLocalTool.mockResolvedValue({ ok: true, message: "Done." });
    const form = new FormData();
    expect(await localToolAction(null, form)).toEqual({ ok: true, message: "Done." });
    expect(runLocalTool).toHaveBeenCalledWith(sessionClient, serviceClient, form, expect.any(Date), devData);
    expect(supabaseDevData).toHaveBeenCalledWith(serviceClient);
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });

  it("refuses without the local Supabase before making a service-role client", async () => {
    localToolsEnabled.mockReturnValue(false);
    expect(await localToolAction(null, new FormData())).toEqual({ ok: false, message: "Local tools work only with the local Supabase." });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(runLocalTool).not.toHaveBeenCalled();
  });

  it("passes a refusal on without refreshing", async () => {
    runLocalTool.mockResolvedValue({ ok: false, message: "Only admins can use local tools." });
    expect(await localToolAction(null, new FormData())).toEqual({ ok: false, message: "Only admins can use local tools." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
