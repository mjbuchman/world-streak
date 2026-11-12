import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc: mocks.rpc }) }));

import { requireAdminPage } from "./adminPage";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.notFound.mockClear();
});

describe("requireAdminPage", () => {
  it("gives an admin their own client", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const db = await requireAdminPage();
    expect(db.rpc).toBe(mocks.rpc);
    expect(mocks.rpc).toHaveBeenCalledWith("is_admin");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  // is_admin() answers false for a signed-out caller (no auth.uid()) as for a player.
  it.each([
    ["a player", false],
    ["a signed-out visitor", null],
  ])("sends %s to notFound", async (_, answer) => {
    mocks.rpc.mockResolvedValue({ data: answer, error: null });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
