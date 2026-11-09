import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const startAttempt = vi.hoisted(() => vi.fn());
const adminClient = vi.hoisted(() => ({ admin: true }));
const store = vi.hoisted(() => ({ store: true }));
const supabaseAttemptStore = vi.hoisted(() => vi.fn(() => store));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient }));
vi.mock("@/lib/attempts/start", () => ({ startAttempt }));
vi.mock("@/lib/attempts/store", () => ({ supabaseAttemptStore }));

import { POST } from "./route";

const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

beforeEach(() => {
  getUser.mockReset();
  startAttempt.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/attempts/start", () => {
  it("returns 401 when signed out, without starting anything", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing" } });
    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(startAttempt).not.toHaveBeenCalled();
  });

  it("starts the signed-in player's attempt with the admin store and passes the result through", async () => {
    signedIn();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T12:34:56Z"));
    const fill = (array: Uint32Array) => {
      array[0] = 3_000_000_000;
      return array;
    };
    vi.spyOn(crypto, "getRandomValues").mockImplementation(fill as typeof crypto.getRandomValues);
    startAttempt.mockResolvedValue({ status: 409, body: { error: "already-started", submitted: true } });
    const response = await POST();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already-started", submitted: true });

    expect(supabaseAttemptStore).toHaveBeenCalledWith(adminClient);
    const [{ userId, now, store: usedStore, randomSeed }] = startAttempt.mock.calls[0];
    expect(userId).toBe("u1");
    expect(usedStore).toBe(store);
    expect(now.toISOString()).toBe("2026-11-08T12:34:56.000Z");
    // The seed comes from the platform's secure random source.
    expect(randomSeed()).toBe(3_000_000_000);
  });

  it("returns 500 without details when starting fails", async () => {
    signedIn();
    startAttempt.mockRejectedValue(new Error("connection refused"));
    const response = await POST();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server-error" });
  });

  it("tells caches not to store the response", async () => {
    signedIn();
    startAttempt.mockResolvedValue({ status: 200, body: {} });
    expect((await POST()).headers.get("cache-control")).toBe("no-store");
  });
});
