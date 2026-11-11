import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isMeterBody, meterBody, meterCacheSeconds, meterHiddenFrom, type MeterRow } from "./meter";

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

describe("isMeterBody", () => {
  // Every kind of body the endpoint can send. If meterBody changes shape (T21 fills in `streak`)
  // without the check following, the UI would show "unavailable"; this fails first.
  const bodies = [
    ["open with a rate", meterBody(open, "2026-11-08", row)],
    ["open with no rate yet", meterBody(open, "2026-11-08", { ...row, weightedAttempts: 0, weightedPasses: 0 })],
    ["open before the day's row exists", meterBody(open, "2026-11-08", { ...row, threshold: null })],
    ["hidden", meterBody(hidden, "2026-11-08", row)],
    ["hidden before the day's row exists", meterBody(hidden, "2026-11-08", { ...row, threshold: null })],
  ] as const;

  it.each(bodies)("accepts every body meterBody produces: %s", (_name, body) => {
    // Through JSON, as the browser receives it.
    expect(isMeterBody(JSON.parse(JSON.stringify(body)))).toBe(true);
  });

  it("rejects an open body whose streak is not the null it is today", () => {
    expect(isMeterBody({ ...meterBody(open, "2026-11-08", row), streak: 3 })).toBe(false);
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

  it("lives in a module the browser loads cheaply: it imports only config and the game-day arithmetic", () => {
    // The meter UI (T19) loads this module in the browser. Anything it imports ships too, so
    // Supabase, zod or the database parsers (src/lib/meterRead.ts uses those) must stay out.
    // Every module specifier in the file: `from "x"` (imports and re-exports, however laid out),
    // a bare `import "x"`, and a dynamic `import("x")`.
    const specifiersOf = (file: string) =>
      [
        ...readFileSync(path.join(import.meta.dirname, file), "utf8").matchAll(
          /\bfrom\s+"([^"]+)"|\bimport\s+"([^"]+)"|\bimport\(\s*"([^"]+)"/g,
        ),
      ].map(([, from, bare, dynamic]) => from ?? bare ?? dynamic);
    expect(specifiersOf("meter.ts").sort()).toEqual(["@/config/meter", "@/lib/gameDay"]);
    expect(specifiersOf("gameDay.ts")).toEqual(["@/config/schedule"]);
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

