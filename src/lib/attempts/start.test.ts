import { describe, expect, it, vi } from "vitest";
import { paramsFromSeed } from "@/challenges/stacking/engine";
import { startAttempt, type AttemptStore } from "./start";

const userId = "00000000-0000-0000-0000-00000000000a";
// 23:30 UTC on Nov 8 is still game date Nov 8 (midnight UTC deadline).
const now = new Date("2026-11-08T23:30:00Z");

function fakeStore(overrides: Partial<AttemptStore> = {}): AttemptStore {
  return {
    hasProfile: vi.fn(async () => true),
    ensureGameDay: vi.fn(async () => undefined),
    challengeTypeFor: vi.fn(async () => "stacking"),
    findAttempt: vi.fn(async () => null),
    insertAttempt: vi.fn(async () => ({ id: "attempt-1" })),
    ...overrides,
  };
}

const start = (store: AttemptStore, seed = 1234) => startAttempt({ userId, now, store, randomSeed: () => seed });

describe("startAttempt", () => {
  it("refuses a player with no profile, and creates nothing", async () => {
    const store = fakeStore({ hasProfile: vi.fn(async () => false) });
    expect(await start(store)).toEqual({ status: 403, body: { error: "profile-required" } });
    expect(store.hasProfile).toHaveBeenCalledWith(userId);
    expect(store.ensureGameDay).not.toHaveBeenCalled();
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("creates today's game day, then an attempt with a server seed, and returns the instance", async () => {
    const store = fakeStore();
    expect(await start(store, 4294967295)).toEqual({
      status: 200,
      body: {
        attemptId: "attempt-1",
        gameDate: "2026-11-08",
        challengeType: "stacking",
        seed: 4294967295,
        params: paramsFromSeed(4294967295),
      },
    });
    expect(store.ensureGameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.challengeTypeFor).toHaveBeenCalledWith("2026-11-08");
    expect(store.insertAttempt).toHaveBeenCalledWith({ userId, gameDate: "2026-11-08", seed: 4294967295 });
  });

  it("refuses a second start the same day, saying whether the first was submitted, and inserts nothing", async () => {
    for (const submitted of [false, true]) {
      const store = fakeStore({ findAttempt: vi.fn(async () => ({ submitted })) });
      expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted } });
      expect(store.findAttempt).toHaveBeenCalledWith(userId, "2026-11-08");
      expect(store.insertAttempt).not.toHaveBeenCalled();
    }
  });

  it("maps losing a race to a simultaneous request (the unique constraint) to 409", async () => {
    const findAttempt = vi.fn<AttemptStore["findAttempt"]>().mockResolvedValueOnce(null).mockResolvedValueOnce({ submitted: false });
    const store = fakeStore({ findAttempt, insertAttempt: vi.fn(async () => "duplicate" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted: false } });
    expect(findAttempt).toHaveBeenCalledTimes(2);
  });

  it("still answers 409, as not submitted, if the winning row cannot be read back", async () => {
    const store = fakeStore({ insertAttempt: vi.fn(async () => "duplicate" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted: false } });
  });

  it("fails loudly on a game day whose challenge type the server does not know", async () => {
    const store = fakeStore({ challengeTypeFor: vi.fn(async () => "chess") });
    await expect(start(store)).rejects.toThrow(/chess/);
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("refuses a seed outside the unsigned 32-bit range", async () => {
    for (const seed of [-1, 2 ** 32, 1.5]) {
      await expect(start(fakeStore(), seed)).rejects.toThrow(/seed/);
    }
  });
});
