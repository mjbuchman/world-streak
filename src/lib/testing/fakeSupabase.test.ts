import { describe, expect, it } from "vitest";
import { fakeSupabase } from "./fakeSupabase";

describe("fakeSupabase", () => {
  it("answers each query with the next result and records its builder calls", async () => {
    const { db, queries } = fakeSupabase([
      { data: [1], error: null },
      { data: true, error: null },
    ]);
    expect(await db.from("game_days").select("game_date").eq("game_date", "2026-11-12")).toEqual({ data: [1], error: null });
    expect(await db.rpc("is_admin")).toEqual({ data: true, error: null });
    expect(queries).toEqual([
      [["from", "game_days"], ["select", "game_date"], ["eq", "game_date", "2026-11-12"]],
      [["rpc", "is_admin"]],
    ]);
  });

  it("can answer by the first call and report each await", async () => {
    const awaited: unknown[] = [];
    const { db } = fakeSupabase((first) => ({ data: first[0], error: null }), { onAwait: (log) => awaited.push(log[0]) });
    expect(await db.rpc("challenge_for", { d: "x" })).toEqual({ data: "rpc", error: null });
    expect(awaited).toEqual([["rpc", "challenge_for", { d: "x" }]]);
  });
});
