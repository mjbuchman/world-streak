import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
const submitAttempt = vi.hoisted(() => vi.fn());
const adminClient = vi.hoisted(() => ({ admin: true }));
const store = vi.hoisted(() => ({ store: true }));
const supabaseAttemptStore = vi.hoisted(() => vi.fn(() => store));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => adminClient }));
vi.mock("@/lib/attempts/submit", () => ({ submitAttempt }));
vi.mock("@/lib/attempts/store", () => ({ supabaseAttemptStore }));

import { POST } from "./route";

const post = (body: string) => POST(new Request("http://localhost/api/attempts/submit", { method: "POST", body }));
const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

beforeEach(() => {
  getUser.mockReset();
  submitAttempt.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/attempts/submit", () => {
  it("returns 401 when signed out, without reading the body", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing" } });
    const response = await post("{}");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(submitAttempt).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not JSON", async () => {
    signedIn();
    const response = await post("not json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-body" });
    expect(submitAttempt).not.toHaveBeenCalled();
  });

  it("returns 413 for a body over 64 KB, without parsing or submitting it", async () => {
    signedIn();
    const huge = JSON.stringify({ attemptId: "a1", inputs: { tapsMs: [], padding: "x".repeat(70_000) } });
    const response = await post(huge);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too-large" });
    expect(submitAttempt).not.toHaveBeenCalled();
  });

  it("returns 413 when the declared length is over the limit", async () => {
    signedIn();
    const request = new Request("http://localhost/api/attempts/submit", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(1_000_000) },
    });
    expect((await POST(request)).status).toBe(413);
    expect(submitAttempt).not.toHaveBeenCalled();
  });

  it("submits for the signed-in player with the admin store, and passes the result through", async () => {
    signedIn();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T12:34:56Z"));
    submitAttempt.mockResolvedValue({ status: 422, body: { error: "implausible-timing" } });

    const response = await post(JSON.stringify({ attemptId: "a1", inputs: { tapsMs: [900] } }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "implausible-timing" });

    expect(supabaseAttemptStore).toHaveBeenCalledWith(adminClient);
    const [{ userId, body, now, store: usedStore }] = submitAttempt.mock.calls[0];
    expect(userId).toBe("u1");
    expect(body).toEqual({ attemptId: "a1", inputs: { tapsMs: [900] } });
    expect(now.toISOString()).toBe("2026-11-08T12:34:56.000Z");
    expect(usedStore).toBe(store);
  });

  it("returns 500 without details when submitting fails", async () => {
    signedIn();
    submitAttempt.mockRejectedValue(new Error("connection refused"));
    const response = await post("{}");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server-error" });
  });

  it("tells caches not to store any response", async () => {
    signedIn();
    submitAttempt.mockResolvedValue({ status: 200, body: { score: 1, passed: false, passTarget: 10 } });
    expect((await post("{}")).headers.get("cache-control")).toBe("no-store");
    expect((await post("not json")).headers.get("cache-control")).toBe("no-store");
  });
});
