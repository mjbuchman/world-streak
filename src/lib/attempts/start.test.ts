import { describe, expect, it, vi } from "vitest";
import { fairSplit } from "@/challenges/fair-split/engine";
import { flashCount } from "@/challenges/flash-count/engine";
import { innerClock } from "@/challenges/inner-clock/engine";
import { paramsFromSeed } from "@/challenges/stacking/engine";
import { startAttempt, type AttemptStore } from "./start";
import type { GameAttempt, GameDay } from "./types";

const userId = "00000000-0000-0000-0000-00000000000a";
// 23:30 UTC on Nov 8 is still game date Nov 8 (midnight UTC deadline).
const now = new Date("2026-11-08T23:30:00Z");

const lineup: GameDay = {
  closed: false,
  games: [
    { position: 1, challengeType: "stacking", passTarget: 12 },
    { position: 2, challengeType: "inner-clock", passTarget: 4 },
    { position: 3, challengeType: "flash-count", passTarget: 5 },
  ],
};
const won = (position: number): GameAttempt => ({ position, submitted: true, score: 20, passed: true });
const lost = (position: number): GameAttempt => ({ position, submitted: true, score: 1, passed: false });
const open = (position: number): GameAttempt => ({ position, submitted: false });

function fakeStore(overrides: Partial<AttemptStore> = {}): AttemptStore {
  return {
    hasProfile: vi.fn(async () => true),
    ensureGameDay: vi.fn(async () => undefined),
    gameDay: vi.fn(async () => lineup),
    dayAttempts: vi.fn(async () => []),
    insertAttempt: vi.fn(async () => ({ id: "attempt-1" })),
    ...overrides,
  };
}

const withAttempts = (attempts: GameAttempt[], overrides: Partial<AttemptStore> = {}) =>
  fakeStore({ dayAttempts: vi.fn(async () => attempts), ...overrides });

const start = (store: AttemptStore, seed = 1234) => startAttempt({ userId, now, store, randomSeed: () => seed });

describe("startAttempt", () => {
  it("refuses a player with no profile, and creates nothing", async () => {
    const store = fakeStore({ hasProfile: vi.fn(async () => false) });
    expect(await start(store)).toEqual({ status: 403, body: { error: "profile-required" } });
    expect(store.hasProfile).toHaveBeenCalledWith(userId);
    expect(store.ensureGameDay).not.toHaveBeenCalled();
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("creates today's game day, then starts game 1 with a server seed, and returns its instance and target", async () => {
    const store = fakeStore();
    expect(await start(store, 4294967295)).toEqual({
      status: 200,
      body: {
        attemptId: "attempt-1",
        gameDate: "2026-11-08",
        position: 1,
        challengeType: "stacking",
        seed: 4294967295,
        params: paramsFromSeed(4294967295),
        passTarget: 12,
      },
    });
    expect(store.ensureGameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.gameDay).toHaveBeenCalledWith("2026-11-08");
    expect(store.dayAttempts).toHaveBeenCalledWith(userId, "2026-11-08");
    // On a fresh day the lineup only exists once ensureGameDay has run.
    const order = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(order(store.ensureGameDay)).toBeLessThan(order(store.gameDay));
    expect(store.insertAttempt).toHaveBeenCalledWith({ userId, gameDate: "2026-11-08", position: 1, seed: 4294967295 });
  });

  it.each([
    ["game 2 after a win", [won(1)], 2, "inner-clock", innerClock.paramsFromSeed, 4],
    ["game 3 after a win and a loss", [won(1), lost(2)], 3, "flash-count", flashCount.paramsFromSeed, 5],
  ] as const)("starts %s, with that game's challenge and its own target", async (_, attempts, position, challengeType, paramsFor, passTarget) => {
    const store = withAttempts([...attempts]);
    expect(await start(store, 99)).toEqual({
      status: 200,
      body: { attemptId: "attempt-1", gameDate: "2026-11-08", position, challengeType, seed: 99, params: paramsFor(99), passTarget },
    });
    expect(store.insertAttempt).toHaveBeenCalledWith({ userId, gameDate: "2026-11-08", position, seed: 99 });
  });

  it("moves on to the next game when the previous one was started but never submitted (it stays a loss)", async () => {
    const store = withAttempts([open(1)]);
    expect(await start(store)).toMatchObject({ status: 200, body: { position: 2, challengeType: "inner-clock" } });
  });

  it("still starts the remaining game once the day is decided", async () => {
    // Two wins decide a passed day; the third game may still be played.
    const store = withAttempts([won(1), won(2)]);
    expect(await start(store)).toMatchObject({ status: 200, body: { position: 3, challengeType: "flash-count" } });
  });

  it("answers 409 day-complete once all three games have started, and inserts nothing", async () => {
    for (const attempts of [[won(1), lost(2), open(3)], [lost(1), lost(2), won(3)]]) {
      const store = withAttempts(attempts);
      expect(await start(store)).toEqual({ status: 409, body: { error: "day-complete" } });
      expect(store.insertAttempt).not.toHaveBeenCalled();
    }
  });

  it("answers day-complete after the one game of a day from before the lineups (T151)", async () => {
    const oneGame: GameDay = { closed: false, games: [lineup.games[0]] };
    const store = withAttempts([won(1)], { gameDay: vi.fn(async () => oneGame) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "day-complete" } });
  });

  it("answers 409 already-started to the loser of two simultaneous starts of the same game", async () => {
    // Both read no attempt for game 2; the unique constraint lets one row in.
    const store = withAttempts([won(1)], { insertAttempt: vi.fn(async () => "duplicate" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "already-started" } });
    expect(store.insertAttempt).toHaveBeenCalledWith(expect.objectContaining({ position: 2 }));
  });

  it("answers 409 day-closed when the day closed between working out the date and the insert", async () => {
    // The close job ran at the deadline just as this start was being made (T93).
    const store = fakeStore({ insertAttempt: vi.fn(async () => "day-closed" as const) });
    expect(await start(store)).toEqual({ status: 409, body: { error: "day-closed" } });
  });

  it("fails loudly if the day still does not exist after ensureGameDay", async () => {
    const store = fakeStore({ gameDay: vi.fn(async () => null) });
    await expect(start(store)).rejects.toThrow("Game day 2026-11-08 does not exist");
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("fails loudly on a lineup game whose challenge type the server does not know", async () => {
    const chess: GameDay = { closed: false, games: [{ position: 1, challengeType: "chess", passTarget: 1 }] };
    const store = fakeStore({ gameDay: vi.fn(async () => chess) });
    await expect(start(store)).rejects.toThrow(/chess/);
    expect(store.insertAttempt).not.toHaveBeenCalled();
  });

  it("starts any registered challenge with its own instance (no type-specific branches)", async () => {
    const split: GameDay = { closed: false, games: [{ position: 1, challengeType: "fair-split", passTarget: 5 }] };
    const store = fakeStore({ gameDay: vi.fn(async () => split) });
    expect(await start(store, 7)).toMatchObject({ status: 200, body: { challengeType: "fair-split", params: fairSplit.paramsFromSeed(7) } });
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
