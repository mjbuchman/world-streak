import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { canDraw, drawCycle, markPaid, payoutDeadline, pickWinner, readDrawCycles, readWinners } from "./draw";

describe("pickWinner", () => {
  const entries = [
    { userId: "A", tickets: 3 },
    { userId: "B", tickets: 1 },
  ];

  it.each([
    [0, "A"],
    [1, "A"],
    [2, "A"],
    [3, "B"],
  ])("maps ticket %i to %s", (index, winner) => {
    expect(pickWinner(entries, () => index)).toBe(winner);
  });

  it("asks for a ticket among all of them", () => {
    const randomInt = vi.fn(() => 0);
    pickWinner(entries, randomInt);
    expect(randomInt).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("throws with no tickets, or a ticket out of range", () => {
    expect(() => pickWinner([], () => 0)).toThrow("No tickets to draw from");
    expect(() => pickWinner([{ userId: "A", tickets: 0 }], () => 0)).toThrow("No tickets to draw from");
    expect(() => pickWinner(entries, () => 4)).toThrow("Ticket 4 is out of range");
  });
});

describe("canDraw", () => {
  const today = "2027-03-05";
  it("is true only for a won cycle that has ended and has no winner yet", () => {
    expect(canDraw({ endDate: "2027-03-01", goalReachedOn: "2027-01-30", drawnAt: null }, today)).toBe(true);
    expect(canDraw({ endDate: "2027-03-05", goalReachedOn: "2027-01-30", drawnAt: null }, today)).toBe(false);
    expect(canDraw({ endDate: "2027-03-01", goalReachedOn: null, drawnAt: null }, today)).toBe(false);
    expect(canDraw({ endDate: "2027-03-01", goalReachedOn: "2027-01-30", drawnAt: "2027-03-02T00:00:00Z" }, today)).toBe(false);
  });
});

type Result = { data: unknown; error: { message: string } | null };

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const calls: unknown[][][] = [];
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    calls.push(log);
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
  const db = { from: (table: string) => start(["from", table]), rpc: (name: string, args?: unknown) => start(["rpc", name, args]) };
  return { db: db as unknown as SupabaseClient, calls };
}

const ADMIN: Result = { data: true, error: null };
const form = (cycle: string) => {
  const data = new FormData();
  data.set("cycle", cycle);
  return data;
};
const TICKETS: Result = {
  data: [
    { user_id: "A", tickets: 3 },
    { user_id: "B", tickets: 1 },
  ],
  error: null,
};

describe("drawCycle", () => {
  it("draws a ticket among the cycle's tickets and stores that player as the winner", async () => {
    const { db, calls } = fakeDb([ADMIN, TICKETS, { data: "drawn", error: null }]);
    expect(await drawCycle(db, form("1"), () => 3)).toEqual({ ok: true, message: "Cycle 1 drawn." });
    expect(calls[1]).toEqual([["rpc", "admin_draw_tickets", { p_cycle: 1 }]]);
    expect(calls[2]).toEqual([["rpc", "admin_record_winner", { p_cycle: 1, p_user: "B" }]]);
  });

  it("refuses anyone who is not an admin, before drawing", async () => {
    const random = vi.fn(() => 0);
    const { db, calls } = fakeDb([{ data: false, error: null }]);
    expect(await drawCycle(db, form("1"), random)).toEqual({ ok: false, message: "Only admins can draw a winner." });
    expect(calls).toHaveLength(1);
    expect(random).not.toHaveBeenCalled();
  });

  it.each(["", "zero", "0", "1.5"])("refuses the cycle %j", async (cycle) => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await drawCycle(db, form(cycle), () => 0)).toEqual({ ok: false, message: "Unknown cycle." });
    expect(calls).toHaveLength(1);
  });

  it("refuses a cycle with no tickets (not drawable, or no entries left)", async () => {
    const { db, calls } = fakeDb([ADMIN, { data: [], error: null }]);
    expect(await drawCycle(db, form("2"), () => 0)).toEqual({
      ok: false,
      message: "Cycle 2 cannot be drawn: it has not ended with the goal reached, or it has no entries left.",
    });
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["already-drawn", "Cycle 1 already has a winner."],
    ["not-ready", "Cycle 1 cannot be drawn yet."],
    ["not-entered", "The entries changed while drawing. Draw again."],
  ])("reports %s", async (status, message) => {
    const { db } = fakeDb([ADMIN, TICKETS, { data: status, error: null }]);
    expect(await drawCycle(db, form("1"), () => 0)).toEqual({ ok: false, message });
  });

  it("says so when the database answers something it does not know", async () => {
    const { db } = fakeDb([ADMIN, TICKETS, { data: "maybe", error: null }]);
    expect(await drawCycle(db, form("1"), () => 0)).toEqual({ ok: false, message: "Unexpected answer: maybe" });
  });

  it("throws on a database error", async () => {
    await expect(drawCycle(fakeDb([ADMIN, { data: null, error: { message: "down" } }]).db, form("1"), () => 0)).rejects.toThrow(
      "Ticket lookup failed: down",
    );
    await expect(drawCycle(fakeDb([ADMIN, TICKETS, { data: null, error: { message: "down" } }]).db, form("1"), () => 0)).rejects.toThrow(
      "Recording the winner failed: down",
    );
  });
});

describe("readDrawCycles", () => {
  it("lists every cycle, newest first", async () => {
    const row = { number: 1, start_date: "2027-01-01", end_date: "2027-03-01", goal_reached_on: null, drawn_at: null, paid_on: null };
    const { db, calls } = fakeDb([{ data: [row], error: null }]);
    expect(await readDrawCycles(db)).toEqual([
      { number: 1, startDate: "2027-01-01", endDate: "2027-03-01", goalReachedOn: null, drawnAt: null, paidOn: null },
    ]);
    expect(calls[0]).toEqual([
      ["from", "cycles_public"],
      ["select", "number, start_date, end_date, goal_reached_on, drawn_at, paid_on"],
      ["order", "number", { ascending: false }],
    ]);
    await expect(readDrawCycles(fakeDb([{ data: null, error: { message: "down" } }]).db)).rejects.toThrow("Cycle lookup failed: down");
  });
});

describe("payoutDeadline", () => {
  it("is 45 days after the cycle's last day", () => {
    expect(payoutDeadline("2027-03-01")).toBe("2027-04-15");
  });
});

describe("readWinners (T125)", () => {
  it("maps each drawn cycle to its winner's email and verification", async () => {
    const { db, calls } = fakeDb([{ data: [{ cycle_number: 1, email: "w@example.com", email_verified: false }], error: null }]);
    expect(await readWinners(db)).toEqual(new Map([[1, { email: "w@example.com", verified: false }]]));
    expect(calls[0]).toEqual([["rpc", "admin_cycle_winners", undefined]]);
    const noEmail = fakeDb([{ data: [{ cycle_number: 2, email: null, email_verified: false }], error: null }]);
    expect((await readWinners(noEmail.db)).get(2)).toEqual({ email: "(no email)", verified: false });
    await expect(readWinners(fakeDb([{ data: null, error: { message: "down" } }]).db)).rejects.toThrow("Winner lookup failed: down");
  });
});

describe("markPaid (T125)", () => {
  it("marks a drawn cycle paid", async () => {
    const { db, calls } = fakeDb([ADMIN, { data: "paid", error: null }]);
    expect(await markPaid(db, form("1"))).toEqual({ ok: true, message: "Cycle 1 marked paid." });
    expect(calls[1]).toEqual([["rpc", "admin_mark_paid", { p_cycle: 1 }]]);
  });

  it("refuses anyone who is not an admin, and a malformed cycle", async () => {
    const notAdmin = fakeDb([{ data: false, error: null }]);
    expect(await markPaid(notAdmin.db, form("1"))).toEqual({ ok: false, message: "Only admins can mark a prize paid." });
    expect(notAdmin.calls).toHaveLength(1);
    const bad = fakeDb([ADMIN]);
    expect(await markPaid(bad.db, form("x"))).toEqual({ ok: false, message: "Unknown cycle." });
    expect(bad.calls).toHaveLength(1);
  });

  it.each([
    ["not-drawn", "Cycle 1 has no winner yet."],
    ["already-paid", "Cycle 1 is already marked paid."],
    ["maybe", "Unexpected answer: maybe"],
  ])("reports %s", async (status, message) => {
    expect(await markPaid(fakeDb([ADMIN, { data: status, error: null }]).db, form("1"))).toEqual({ ok: false, message });
  });

  it("throws on a database error", async () => {
    await expect(markPaid(fakeDb([ADMIN, { data: null, error: { message: "down" } }]).db, form("1"))).rejects.toThrow(
      "Marking the prize paid failed: down",
    );
  });
});
