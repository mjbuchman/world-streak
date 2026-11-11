import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readMeter = vi.hoisted(() => vi.fn());
const adminClient = vi.hoisted(() => ({ admin: true }));

vi.mock("@/lib/meterRead", () => ({ readMeter }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient }));
// The shared route helpers import the cookie client; the meter never uses it (fails if it does).
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    throw new Error("the meter must not read the session");
  },
}));

import { GET } from "./route";

const hiddenBody = { gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt: "2026-11-09T00:00:00.000Z" };

beforeEach(() => {
  readMeter.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/meter", () => {
  it("answers the meter for now, read with the service role, cached publicly for 30 s", async () => {
    vi.setSystemTime(new Date("2026-11-08T22:00:00Z"));
    readMeter.mockResolvedValue(hiddenBody);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(hiddenBody);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=30");

    const [client, now] = readMeter.mock.calls[0];
    expect(client).toBe(adminClient);
    expect(now.toISOString()).toBe("2026-11-08T22:00:00.000Z");
  });

  it("caches for less right before the reading goes out of date", async () => {
    // 20 s before the deadline: the cached copy and its stale grace must both end by then.
    vi.setSystemTime(new Date("2026-11-08T23:59:40Z"));
    readMeter.mockResolvedValue(hiddenBody);
    expect((await GET()).headers.get("cache-control")).toBe("public, s-maxage=10, stale-while-revalidate=10");
  });

  it("is not cached at all in the final second before the reading goes out of date", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59.500Z"));
    readMeter.mockResolvedValue(hiddenBody);
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });

  it("answers 500 without details, and uncached, when the read fails", async () => {
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    readMeter.mockRejectedValue(new Error("connection refused"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "server-error" });
  });
});
