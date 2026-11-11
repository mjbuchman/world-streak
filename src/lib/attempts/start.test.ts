import { describe, expect, it, vi } from "vitest";
import { paramsFromSeed } from "@/challenges/stacking/engine";
import { startAttempt, type AttemptStore } from "./start";

const userId = "00000000-0000-0000-0000-00000000000a";
// 23:30 UTC on Nov 8 is still game date Nov 8 (midnight UTC deadline).
const now = new Date("2026-11-08T23:30:00Z");

const storedResult = { submitted: true, score: 7, passed: false, passTarget: 10 } as const;

function fakeStore(overrides: Partial<AttemptStore> = {}): AttemptStore {
  return {
    hasProfile: vi.fn(async () => true),
    ensureGameDay: vi.fn(async () => undefined),
    gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 10, closed: false })),
    findAttemptForDay: vi.fn(async () => null),
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

  it("creates today's game day, then an attempt with a server seed, and returns the instance and target", async () => {
    const store = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "stacking", passTarget: 12, closed: false })) });
    expect(await start(store, 4294967295)).toEqual({
      status: 200,
      body: {
        attemptId: "attempt-1",
        gameDate: "2026-11-08",
        challengeType: "stacking",
        seed: 4294967295,
        params: paramsFromSeed(4294967295),
        passTarget: 12,
      },
    });
    expect(store.ensureGameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.gameDay).toHaveBeenCalledWith("2026-11-08");
    // On a fresh day the row only exists once ensureGameDay has run.
    const order = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(order(store.ensureGameDay)).toBeLessThan(order(store.gameDay));
    expect(store.insertAttempt).toHaveBeenCalledWith({ userId, gameDate: "2026-11-08", seed: 4294967295 });
  });

  it("refuses a second start the same day, saying whether the first was submitted, and inserts nothing", async () => {
    for (const existing of [{ submitted: false } as const, storedResult]) {
      const store = fakeStore({ findAttemptForDay: vi.fn(async () => existing) });
      expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted: existing.submitted } });
      expect(store.findAttemptForDay).toHaveBeenCalledWith(userId, "2026-11-08");
      expect(store.insertAttempt).not.toHaveBeenCalled();
    }
  });

  it("maps losing a race to a simultaneous request (the unique constraint) to 409", async () => {
    // The winner already submitted, so the answer must come from re-reading its row.
    const findAttemptForDay = vi
      .fn<AttemptStore["findAttemptForDay"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedResult);
    const store = fakeStore({ findAttemptForDay, insertAttempt: vi.fn(async () => "duplicate" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted: true } });
    expect(findAttemptForDay).toHaveBeenCalledTimes(2);
  });

  it("answers 409 day-closed when the day closed between working out the date and the insert", async () => {
    // The close job ran at the deadline just as this start was being made (T93).
    const store = fakeStore({ insertAttempt: vi.fn(async () => "day-closed" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "day-closed" } });
  });

  it("still answers 409, as not submitted, if the winning row cannot be read back", async () => {
    const store = fakeStore({ insertAttempt: vi.fn(async () => "duplicate" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "already-started", submitted: false } });
  });

  it("fails loudly on a game day whose challenge type the server does not know", async () => {
    const store = fakeStore({ gameDay: vi.fn(async () => ({ challengeType: "chess", passTarget: 10, closed: false })) });
    await expect(start(store)).rejects.toThrow(/chess/);
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("accepts the lowest seed, 0", async () => {
    expect(await start(fakeStore(), 0)).toMatchObject({ status: 200, body: { seed: 0, params: paramsFromSeed(0) } });
  });

  it("refuses a seed outside the unsigned 32-bit range", async () => {
    for (const seed of [-1, 2 ** 32, 1.5]) {
      await expect(start(fakeStore(), seed)).rejects.toThrow(/seed/);
    }
  });
});
