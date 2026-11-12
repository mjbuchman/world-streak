import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readOpenFlags, reviewFlag } from "./adminFlags";

type Result = { data: unknown; error: { message: string } | null };

/** A client whose rpc calls answer `results` in order, recording each call. */
function fakeDb(results: Result[]) {
  const calls: unknown[][] = [];
  const db = {
    rpc: (name: string, args?: unknown) => {
      calls.push(args === undefined ? [name] : [name, args]);
      return Promise.resolve(results.shift());
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const ADMIN: Result = { data: true, error: null };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe("readOpenFlags", () => {
  it("reads the open flags with the player's email, the reason, when, the day and the score", async () => {
    const row = { flag_id: 7, email: "p@example.com", reason: "timing-mismatch", created_at: "2026-11-12T10:00:00Z", game_date: "2026-11-12", score: "12" };
    const { db, calls } = fakeDb([{ data: [row], error: null }]);
    expect(await readOpenFlags(db)).toEqual([
      { id: 7, email: "p@example.com", reason: "timing-mismatch", createdAt: "2026-11-12T10:00:00Z", gameDate: "2026-11-12", score: 12 },
    ]);
    expect(calls).toEqual([["admin_open_flags"]]);
  });

  it("keeps a missing score as null, and throws on a failed read", async () => {
    const row = { flag_id: 1, email: null, reason: "x", created_at: "2026-11-12T10:00:00Z", game_date: "2026-11-12", score: null };
    expect(await readOpenFlags(fakeDb([{ data: [row], error: null }]).db)).toMatchObject([{ email: "(no email)", score: null }]);
    await expect(readOpenFlags(fakeDb([{ data: null, error: { message: "admins only" } }]).db)).rejects.toThrow(
      "Flag lookup failed: admins only",
    );
  });
});

describe("reviewFlag", () => {
  it.each([
    ["dismissed", "Flag dismissed."],
    ["confirmed", "Flag confirmed: the account stays out of the draw."],
  ])("saves a %s decision", async (decision, message) => {
    const { db, calls } = fakeDb([ADMIN, { data: decision, error: null }]);
    expect(await reviewFlag(db, form({ flagId: "7", decision }))).toEqual({ ok: true, message });
    expect(calls).toEqual([["is_admin"], ["review_cheat_flag", { p_flag_id: 7, p_decision: decision }]]);
  });

  it("refuses anyone who is not an admin, before anything else", async () => {
    const { db, calls } = fakeDb([{ data: false, error: null }]);
    expect(await reviewFlag(db, form({ flagId: "7", decision: "dismissed" }))).toEqual({ ok: false, message: "Only admins can review flags." });
    expect(calls).toHaveLength(1);
  });

  it.each([
    [{ flagId: "seven", decision: "dismissed" }],
    [{ flagId: "0", decision: "dismissed" }],
    [{ flagId: "7", decision: "deleted" }],
    [{ decision: "dismissed" }],
  ])("refuses a malformed form %j without writing", async (fields) => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await reviewFlag(db, form(fields))).toEqual({ ok: false, message: "Unknown flag or decision." });
    expect(calls).toHaveLength(1);
  });

  it("says when the flag no longer exists, and throws on a database error", async () => {
    expect(await reviewFlag(fakeDb([ADMIN, { data: "not-found", error: null }]).db, form({ flagId: "7", decision: "dismissed" }))).toEqual({
      ok: false,
      message: "That flag is gone. Reload the page.",
    });
    await expect(
      reviewFlag(fakeDb([ADMIN, { data: null, error: { message: "down" } }]).db, form({ flagId: "7", decision: "dismissed" })),
    ).rejects.toThrow("Reviewing the flag failed: down");
  });
});
