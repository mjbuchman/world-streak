import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readMeter = vi.hoisted(() => vi.fn());
const publicClient = vi.hoisted(() => ({ public: true }));

vi.mock("@/lib/meter", () => ({ readMeter }));
vi.mock("@/lib/supabase/public", () => ({ createSupabasePublicClient: () => publicClient }));
// The shared route helpers import the cookie client; the meter never uses it (fails if it does).
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    throw new Error("the meter must not read the session");
  },
}));

import { GET } from "./route";

beforeEach(() => {
  readMeter.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/meter", () => {
  it("answers the meter for now, read with the public client, cached publicly for 30 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    const body = { gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt: "2026-11-09T00:00:00.000Z" };
    readMeter.mockResolvedValue(body);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(response.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=30");

    const [client, now] = readMeter.mock.calls[0];
    expect(client).toBe(publicClient);
    expect(now.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });

  it("answers 500 without details, and uncached, when the read fails", async () => {
    readMeter.mockRejectedValue(new Error("connection refused"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "server-error" });
  });
});
