import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { meterBody, meterCacheSeconds, meterHiddenFrom, readMeter, type MeterRow } from "./meter";

// Game date 2026-11-08 closes at midnight UTC on Nov 9; the meter hides from 21:00 UTC.
const open = new Date("2026-11-08T20:59:59Z");
const hidden = new Date("2026-11-08T21:00:00Z");
const closesAt = "2026-11-09T00:00:00.000Z";

// 12 attempts, some at reduced weight: the rate uses the weighted counts (7.5 / 10), not 12.
const row: MeterRow = { threshold: 0.6, attempts: 12, weightedAttempts: 10, weightedPasses: 7.5 };

describe("meterBody", () => {
  it("is open before the final hours, with the weighted pass rate and the attempt count", () => {
    expect(meterBody(open, "2026-11-08", row)).toEqual({
      gameDate: "2026-11-08",
      status: "open",
      passRate: 0.75,
      attempts: 12,
      threshold: 0.6,
      closesAt,
      streak: null,
    });
  });

  it("is hidden from three hours before the deadline, with no pass rate or attempt count at all", () => {
    const body = meterBody(hidden, "2026-11-08", row);
    expect(body).toEqual({ gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt });
    expect("passRate" in body).toBe(false);
    expect("attempts" in body).toBe(false);
  });

  it("stays hidden right up to the deadline", () => {
    expect(meterBody(new Date("2026-11-08T23:59:59.999Z"), "2026-11-08", row).status).toBe("hidden");
  });

  it("gives a null pass rate, not NaN, when nobody has played yet", () => {
    const body = meterBody(open, "2026-11-08", { threshold: 0.6, attempts: 0, weightedAttempts: 0, weightedPasses: 0 });
    expect(body).toMatchObject({ status: "open", passRate: null, attempts: 0 });
  });

  it("gives a null pass rate when every attempt so far has zero weight", () => {
    const body = meterBody(open, "2026-11-08", { threshold: 0.6, attempts: 3, weightedAttempts: 0, weightedPasses: 0 });
    expect(body).toMatchObject({ passRate: null, attempts: 3 });
  });
});

describe("meterHiddenFrom", () => {
  it("is METER_HIDE_HOURS before the deadline, from a Date or an ISO string", () => {
    expect(meterHiddenFrom(new Date(closesAt)).toISOString()).toBe("2026-11-08T21:00:00.000Z");
    expect(meterHiddenFrom(closesAt).toISOString()).toBe("2026-11-08T21:00:00.000Z");
  });

  it("splits open from hidden at exactly that instant", () => {
    expect(meterBody(new Date("2026-11-08T20:59:59.999Z"), "2026-11-08", row).status).toBe("open");
    expect(meterBody(new Date("2026-11-08T21:00:00.000Z"), "2026-11-08", row).status).toBe("hidden");
  });

  it("lives in a module client code can import: Supabase is imported as a type only", () => {
    // The meter UI (T19) imports this module in the browser; a runtime Supabase import would
    // pull the client into the bundle.
    // Every module specifier in the file, however the import or re-export is laid out.
    const source = readFileSync(path.join(import.meta.dirname, "meter.ts"), "utf8");
    const specifiers = [...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map(([, specifier]) => specifier);
    expect(specifiers.filter((s) => /supabase|server-only/.test(s))).toEqual(["@supabase/supabase-js"]);
    expect(source).toMatch(/import type \{ SupabaseClient \} from "@supabase\/supabase-js";/);
  });
});

describe("meterCacheSeconds", () => {
  const at = (iso: string) => new Date(iso);
  const openBody = meterBody(open, "2026-11-08", row);
  const hiddenBody = meterBody(hidden, "2026-11-08", row);

  it("caches for 30 s when the reading stays current for a while", () => {
    expect(meterCacheSeconds(openBody, at("2026-11-08T12:00:00Z"))).toBe(30);
    expect(meterCacheSeconds(hiddenBody, at("2026-11-08T22:00:00Z"))).toBe(30);
  });

  it("caches an open reading only until the hidden window starts, counting the stale grace too", () => {
    // 50 s before 21:00: 25 s fresh plus 25 s stale ends exactly at 21:00.
    expect(meterCacheSeconds(openBody, at("2026-11-08T20:59:10Z"))).toBe(25);
    expect(meterCacheSeconds(openBody, at("2026-11-08T20:59:59Z"))).toBe(0);
  });

  it("caches a hidden reading only until the deadline", () => {
    expect(meterCacheSeconds(hiddenBody, at("2026-11-08T23:59:40Z"))).toBe(10);
    expect(meterCacheSeconds(hiddenBody, at("2026-11-08T23:59:59.500Z"))).toBe(0);
  });
});

type Result = { data: unknown; error: { message: string } | null };

/** Records every query-builder call and resolves the query to `result`. */
function fakeDb(result: Result) {
  const calls: unknown[][] = [];
  const query: object = new Proxy(
    {},
    {
      get(_, method) {
        if (method === "then") return (resolve: (value: Result) => void) => resolve(result);
        return (...args: unknown[]) => {
          calls.push([method, ...args]);
          return query;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("readMeter", () => {
  it("reads the day and its counters in one query, never the attempts table", async () => {
    const data = {
      survival_threshold: "0.60",
      game_day_counters: { attempts: 4, weighted_attempts: "4", weighted_passes: "3" },
    };
    const { db, calls } = fakeDb({ data, error: null });
    expect(await readMeter(db, open)).toEqual({
      gameDate: "2026-11-08",
      status: "open",
      passRate: 0.75,
      attempts: 4,
      threshold: 0.6,
      closesAt,
      streak: null,
    });
    expect(calls).toEqual([
      ["from", "game_days"],
      ["select", "survival_threshold, game_day_counters(attempts, weighted_attempts, weighted_passes)"],
      ["eq", "game_date", "2026-11-08"],
      ["maybeSingle"],
    ]);
    expect(calls.filter(([method]) => method === "from")).toEqual([["from", "game_days"]]);
  });

  it("opens the next day's meter at the deadline", async () => {
    // A millisecond before midnight UTC is the hidden end of Nov 8; midnight is the open start of Nov 9.
    const before = fakeDb({ data: null, error: null });
    expect(await readMeter(before.db, new Date("2026-11-08T23:59:59.999Z"))).toMatchObject({
      gameDate: "2026-11-08",
      status: "hidden",
      closesAt: "2026-11-09T00:00:00.000Z",
    });
    expect(before.calls).toContainEqual(["eq", "game_date", "2026-11-08"]);

    const at = fakeDb({ data: null, error: null });
    expect(await readMeter(at.db, new Date("2026-11-09T00:00:00Z"))).toMatchObject({
      gameDate: "2026-11-09",
      status: "open",
      closesAt: "2026-11-10T00:00:00.000Z",
    });
    expect(at.calls).toContainEqual(["eq", "game_date", "2026-11-09"]);
  });

  it("reads the counters whether they come back as an object or a one-element array", async () => {
    const counters = { attempts: 4, weighted_attempts: 4, weighted_passes: 3 };
    const asArray = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: [counters] }, error: null });
    expect(await readMeter(asArray.db, open)).toMatchObject({ passRate: 0.75, attempts: 4 });
    const empty = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: [] }, error: null });
    expect(await readMeter(empty.db, open)).toMatchObject({ passRate: null, attempts: 0 });
  });

  it("shows no attempts yet when the day has no counters row", async () => {
    const { db } = fakeDb({ data: { survival_threshold: 0.6, game_day_counters: null }, error: null });
    expect(await readMeter(db, open)).toMatchObject({ status: "open", passRate: null, attempts: 0, threshold: 0.6 });
  });

  it("has no threshold to show before today's game day exists", async () => {
    const { db } = fakeDb({ data: null, error: null });
    expect(await readMeter(db, open)).toMatchObject({ status: "open", passRate: null, attempts: 0, threshold: null });
  });

  it("throws on a database error, so the endpoint answers 500", async () => {
    const { db } = fakeDb({ data: null, error: { message: "connection refused" } });
    await expect(readMeter(db, open)).rejects.toThrow("Meter lookup failed: connection refused");
  });
});
