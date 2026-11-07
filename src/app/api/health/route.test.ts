import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ rpc }) }));

import { GET } from "./route";

beforeEach(() => rpc.mockReset());

describe("GET /api/health", () => {
  it("returns 200 with db ok when the health_check function answers", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const response = await GET();
    expect(rpc).toHaveBeenCalledWith("health_check");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ db: "ok" });
  });

  it("returns 503 with db unavailable when the query fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ db: "unavailable" });
  });

  it("tells caches not to store the result", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });
});
