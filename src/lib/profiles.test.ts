import { describe, expect, it, vi } from "vitest";
import { landingPath, type ProfileReader } from "./profiles";

function reader(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as ProfileReader, from, select, eq };
}

describe("landingPath", () => {
  it("sends a signed-in player with a profile home", async () => {
    const { client, from, select, eq } = reader({ data: { id: "u1" }, error: null });
    expect(await landingPath(client, "u1")).toBe("/");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("id", "u1");
  });

  it("sends a player without a profile to complete it", async () => {
    const { client } = reader({ data: null, error: null });
    expect(await landingPath(client, "u1")).toBe("/complete-profile");
  });

  it("sends the player home when the lookup fails, rather than asking for a profile they may have", async () => {
    const { client } = reader({ data: null, error: { message: "timeout" } });
    expect(await landingPath(client, "u1")).toBe("/");
  });
});
