import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { FAKE_PLAYER_EMAIL, removeFakePlayers, runSeed, type SeedDeps } from "./devData";

type Result = { data: unknown; error: { message: string } | null };

/** Table calls answer `results` in order; auth lists `pages` and records deletions. */
function fakeDb(results: Result[], pages: { email: string; id: string }[][]) {
  const calls: unknown[][][] = [];
  const builder = (log: unknown[][]): object => {
    const result = results.shift();
    const query: object = new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then") return (resolve: (value: unknown) => void) => resolve(result);
          return (...args: unknown[]) => {
            log.push([method, ...args]);
            return query;
          };
        },
      },
    );
    return query;
  };
  const listUsers = vi.fn(async ({ page }: { page: number }) => ({ data: { users: pages[page - 1] ?? [] }, error: null }));
  const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
  const db = {
    from: (table: string) => {
      const log: unknown[][] = [["from", table]];
      calls.push(log);
      return builder(log);
    },
    rpc: (name: string, args: unknown) => {
      const log: unknown[][] = [["rpc", name, args]];
      calls.push(log);
      return builder(log);
    },
    auth: { admin: { listUsers, deleteUser } },
  } as unknown as SupabaseClient;
  return { db, calls, listUsers, deleteUser };
}

const ok = (data: unknown = null): Result => ({ data, error: null });

describe("FAKE_PLAYER_EMAIL", () => {
  it("matches every email the seed creates, so removing fake players finds them all", async () => {
    const emails: string[] = [];
    const deps: SeedDeps = {
      todayGameDate: async () => "2026-11-12",
      ensureGameDay: async () => {},
      passTarget: async () => 10,
      createPlayer: async (email) => (emails.push(email), `id-${emails.length}`),
      startAttempt: async (userId) => `attempt-${userId}`,
      recordResult: async () => "recorded",
      dayClosed: async () => false,
      writePastResult: async () => {},
      addPastPass: async () => {},
      log: () => {},
    };
    await runSeed({ players: 3, passRate: 0.5, date: null }, Date.now().toString(36), deps);
    expect(emails).toHaveLength(3);
    for (const email of emails) expect(email).toMatch(FAKE_PLAYER_EMAIL);
  });

  it("matches the seed's emails only", () => {
    expect(FAKE_PLAYER_EMAIL.test("seed-mhx1-12@example.test")).toBe(true);
    expect(FAKE_PLAYER_EMAIL.test("admin@local.test")).toBe(false);
    expect(FAKE_PLAYER_EMAIL.test("seed-1@example.test.evil.com")).toBe(false);
    expect(FAKE_PLAYER_EMAIL.test("me-seed-1@example.test")).toBe(false);
  });
});

describe("removeFakePlayers", () => {
  it("deletes only fake players, across pages, then recounts every open day", async () => {
    const firstPage = [
      ...Array.from({ length: 999 }, (_, i) => ({ email: `seed-a-${i}@example.test`, id: `fake-${i}` })),
      { email: "me@example.com", id: "real" },
    ];
    const { db, calls, listUsers, deleteUser } = fakeDb(
      [
        ok([{ game_date: "2026-11-12" }]),
        ok(),
      ],
      [firstPage, [{ email: "seed-b-1@example.test", id: "fake-last" }]],
    );
    expect(await removeFakePlayers(db)).toBe(1000);
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(deleteUser).toHaveBeenCalledTimes(1000);
    expect(deleteUser).not.toHaveBeenCalledWith("real");
    expect(deleteUser).toHaveBeenLastCalledWith("fake-last");
    expect(calls[0]).toEqual([["from", "game_days"], ["select", "game_date"], ["is", "closed_at", null]]);
    expect(calls[1]).toEqual([["rpc", "recount_game_day", { d: "2026-11-12" }]]);
  });

  it("passes a failed recount on", async () => {
    const { db } = fakeDb([ok([{ game_date: "2026-11-12" }]), { data: null, error: { message: "locked" } }], [[]]);
    await expect(removeFakePlayers(db)).rejects.toThrow("Recount failed: locked");
  });

  it("stops at the first failure", async () => {
    const { db, deleteUser } = fakeDb([], [[{ email: "seed-a-1@example.test", id: "fake" }]]);
    deleteUser.mockResolvedValueOnce({ data: {}, error: { message: "nope" } } as never);
    await expect(removeFakePlayers(db)).rejects.toThrow("Deleting a fake player failed: nope");
  });
});
