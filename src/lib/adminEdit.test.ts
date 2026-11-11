import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { saveGameDayEdit } from "./adminEdit";

type Result = { data: unknown; error: { message: string; code?: string } | null };

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
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
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    calls.push(log);
    return builder(log);
  };
  const db = {
    from: (table: string) => start(["from", table]),
    rpc: (name: string) => start(["rpc", name]),
  } as unknown as SupabaseClient;
  return { db, calls };
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};
const edit = (over: Record<string, string> = {}) => form({ gameDate: "2026-11-12", passTarget: "9", thresholdPercent: "55", ...over });

const ADMIN: Result = { data: true, error: null };
const OPEN_STACKING: Result = { data: { challenge_type: "stacking", closed_at: null }, error: null };

describe("saveGameDayEdit", () => {
  it("saves the pass target and the threshold as a fraction, marking the day edited", async () => {
    const { db, calls } = fakeDb([ADMIN, OPEN_STACKING, { data: [{ game_date: "2026-11-12" }], error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: true, message: "Saved Nov 12, 2026." });
    expect(calls[2]).toEqual([
      ["from", "game_days"],
      ["update", { pass_target: 9, survival_threshold: 0.55, edited: true }],
      ["eq", "game_date", "2026-11-12"],
      ["is", "closed_at", null],
      ["select", "game_date"],
    ]);
  });

  it("refuses anyone who is not an admin, before reading or writing anything", async () => {
    const { db, calls } = fakeDb([{ data: false, error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: false, message: "Only admins can edit game days." });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a threshold of 150%", { thresholdPercent: "150" }, "Survival threshold must be from 0% to 100%."],
    ["a negative threshold", { thresholdPercent: "-1" }, "Survival threshold must be from 0% to 100%."],
    ["a threshold that is not a number", { thresholdPercent: "lots" }, "Survival threshold must be a number."],
    ["a missing pass target", { passTarget: " " }, "Pass target is required."],
    ["a negative pass target", { passTarget: "-2" }, "Pass target cannot be negative."],
    ["a malformed date", { gameDate: "tomorrow" }, "Unknown game day."],
  ])("refuses %s without touching the database", async (_name, over, message) => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, edit(over))).toEqual({ ok: false, message });
    expect(calls).toHaveLength(1);
  });

  it("refuses a form with no fields at all, without touching the database", async () => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, new FormData())).toEqual({ ok: false, message: "Unknown game day." });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["the pass target", "passTarget", "Pass target is required."],
    ["the threshold", "thresholdPercent", "Survival threshold is required."],
  ])("refuses a form missing %s", async (_name, field, message) => {
    const fields = { gameDate: "2026-11-12", passTarget: "9", thresholdPercent: "55" };
    delete (fields as Record<string, string>)[field];
    const { db } = fakeDb([ADMIN]);
    expect(await saveGameDayEdit(db, form(fields))).toEqual({ ok: false, message });
  });

  it("refuses a closed day", async () => {
    const { db, calls } = fakeDb([ADMIN, { data: { challenge_type: "stacking", closed_at: "2026-11-13T00:00:05Z" }, error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: false, message: "Nov 12, 2026 has closed, so it can no longer change." });
    expect(calls).toHaveLength(2);
  });

  it("refuses a day that closes between the check and the save", async () => {
    const { db } = fakeDb([ADMIN, OPEN_STACKING, { data: [], error: null }]);
    expect(await saveGameDayEdit(db, edit())).toMatchObject({ ok: false, message: /has closed/ });
  });

  it("reports the database's lock on a started day's pass target (WS002) as a refusal", async () => {
    const locked = { data: null, error: { code: "WS002", message: "game day 2026-11-12 has started, so its pass target is locked" } };
    const { db } = fakeDb([ADMIN, OPEN_STACKING, locked]);
    expect(await saveGameDayEdit(db, edit())).toEqual({
      ok: false,
      message: "Nov 12, 2026 has started, so its pass target can no longer change. The threshold still can.",
    });
  });

  it("refuses an unknown day", async () => {
    const { db } = fakeDb([ADMIN, { data: null, error: null }]);
    expect(await saveGameDayEdit(db, edit())).toEqual({ ok: false, message: "Unknown game day." });
  });

  it.each(["0", "16", "15.5"])("keeps a Tower target on the board's 15 rows (refuses %s, writing nothing)", async (passTarget) => {
    const { db, calls } = fakeDb([ADMIN, OPEN_STACKING]);
    expect(await saveGameDayEdit(db, edit({ passTarget }))).toEqual({
      ok: false,
      message: "The Teetering Tower's pass target must be a row from 1 to 15.",
    });
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["the lowest Tower target", { passTarget: "1" }, { pass_target: 1, survival_threshold: 0.55 }],
    ["the highest Tower target", { passTarget: "15" }, { pass_target: 15, survival_threshold: 0.55 }],
    ["a threshold of 0%", { thresholdPercent: "0" }, { pass_target: 9, survival_threshold: 0 }],
    ["a threshold of 100%", { thresholdPercent: "100" }, { pass_target: 9, survival_threshold: 1 }],
  ])("accepts %s", async (_name, over, values) => {
    const { db, calls } = fakeDb([ADMIN, OPEN_STACKING, { data: [{}], error: null }]);
    expect(await saveGameDayEdit(db, edit(over))).toMatchObject({ ok: true });
    expect(calls[2]).toContainEqual(["update", { ...values, edited: true }]);
  });

  it("allows a fractional Tower target on the board, and any non-negative target for other challenges", async () => {
    const tower = fakeDb([ADMIN, OPEN_STACKING, { data: [{}], error: null }]);
    expect(await saveGameDayEdit(tower.db, edit({ passTarget: "1.5" }))).toMatchObject({ ok: true });
    const other = fakeDb([ADMIN, { data: { challenge_type: "flashCount", closed_at: null }, error: null }, { data: [{}], error: null }]);
    expect(await saveGameDayEdit(other.db, edit({ passTarget: "40" }))).toMatchObject({ ok: true });
  });

  it("throws on a database error, so the page shows its error rather than a false message", async () => {
    const lookup = fakeDb([ADMIN, { data: null, error: { message: "down" } }]);
    await expect(saveGameDayEdit(lookup.db, edit())).rejects.toThrow("Game day lookup failed: down");
    const save = fakeDb([ADMIN, OPEN_STACKING, { data: null, error: { code: "42501", message: "denied" } }]);
    await expect(saveGameDayEdit(save.db, edit())).rejects.toThrow("Saving the game day failed: denied");
  });
});
