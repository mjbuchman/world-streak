import { describe, expect, it, vi } from "vitest";
import { insertProfile, landingPath, type ProfileReader } from "./profiles";

describe("insertProfile", () => {
  function writer(error: { code?: string } | null) {
    const insert = vi.fn(async () => ({ error }));
    const from = vi.fn(() => ({ insert }));
    return { client: { from } as unknown as ProfileReader, from, insert };
  }

  it("writes the profile row and reports ok", async () => {
    const { client, from, insert } = writer(null);
    expect(await insertProfile(client, { userId: "u1", birthDate: "1990-05-05", country: "US" })).toBe("ok");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(insert).toHaveBeenCalledWith({ id: "u1", birth_date: "1990-05-05", country: "US" });
  });

  it("reports a profile that is already there (a unique violation) as exists", async () => {
    expect(await insertProfile(writer({ code: "23505" }).client, { userId: "u1", birthDate: "1990-05-05", country: "US" })).toBe("exists");
  });

  it("reports any other failure as error", async () => {
    expect(await insertProfile(writer({ code: "42501" }).client, { userId: "u1", birthDate: "1990-05-05", country: "US" })).toBe("error");
  });
});

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
