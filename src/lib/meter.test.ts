import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMeterBody, meterBody, meterCacheSeconds, meterHiddenFrom, meterHiddenMessage, type MeterRow } from "./meter";

// The setting is 0 (shown until the deadline); most tests here switch on a 3-hour window so the
// hidden path stays tested and can be turned back on.
const config = vi.hoisted(() => ({ hideHours: 3 }));
vi.mock("@/config/meter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/meter")>()),
  get METER_HIDE_HOURS() {
    return config.hideHours;
  },
}));
beforeEach(() => {
  config.hideHours = 3;
});

// Game date 2026-11-08 closes at midnight UTC on Nov 9; with 3 hours the meter hides from 21:00 UTC.
const open = new Date("2026-11-08T20:59:59Z");
const hidden = new Date("2026-11-08T21:00:00Z");
const closesAt = "2026-11-09T00:00:00.000Z";

// 12 attempts, some at reduced weight: the rate uses the weighted counts (7.5 / 10), not 12.
const streak = { current: 4, best: 9 };
const row: MeterRow = { threshold: 0.6, attempts: 12, weightedAttempts: 10, weightedPasses: 7.5, streak };

describe("meterBody", () => {
  it("is open before the final hours, with the weighted pass rate and the attempt count", () => {
    expect(meterBody(open, "2026-11-08", row)).toEqual({
      gameDate: "2026-11-08",
      status: "open",
      passRate: 0.75,
      attempts: 12,
      threshold: 0.6,
      closesAt,
      streak,
    });
  });

  it("is hidden from three hours before the deadline, with no pass rate or attempt count at all, but the streak", () => {
    const body = meterBody(hidden, "2026-11-08", row);
    expect(body).toEqual({ gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt, streak });
    expect("passRate" in body).toBe(false);
    expect("attempts" in body).toBe(false);
  });

  it("stays hidden right up to the deadline", () => {
    expect(meterBody(new Date("2026-11-08T23:59:59.999Z"), "2026-11-08", row).status).toBe("hidden");
  });

  it("gives a null pass rate, not NaN, when nobody has played yet", () => {
    const body = meterBody(open, "2026-11-08", { ...row, attempts: 0, weightedAttempts: 0, weightedPasses: 0 });
    expect(body).toMatchObject({ status: "open", passRate: null, attempts: 0 });
  });

  it("gives a null pass rate when every attempt so far has zero weight", () => {
    const body = meterBody(open, "2026-11-08", { ...row, attempts: 3, weightedAttempts: 0, weightedPasses: 0 });
    expect(body).toMatchObject({ passRate: null, attempts: 3 });
  });
});

describe("isMeterBody", () => {
  // Every kind of body the endpoint can send. If meterBody changes shape without the check
  // following, the UI would show "unavailable"; this fails first.
  const noStreak = { current: 0, best: 0 };
  const bodies = [
    ["open with a rate", meterBody(open, "2026-11-08", row)],
    ["open with no rate yet", meterBody(open, "2026-11-08", { ...row, weightedAttempts: 0, weightedPasses: 0 })],
    ["open before the day's row exists", meterBody(open, "2026-11-08", { ...row, threshold: null })],
    ["open with no streak yet", meterBody(open, "2026-11-08", { ...row, streak: noStreak })],
    ["hidden", meterBody(hidden, "2026-11-08", row)],
    ["hidden before the day's row exists", meterBody(hidden, "2026-11-08", { ...row, threshold: null })],
    ["hidden with no streak yet", meterBody(hidden, "2026-11-08", { ...row, streak: noStreak })],
  ] as const;

  it.each(bodies)("accepts every body meterBody produces: %s", (_name, body) => {
    // Through JSON, as the browser receives it.
    expect(isMeterBody(JSON.parse(JSON.stringify(body)))).toBe(true);
  });

  const openBody = meterBody(open, "2026-11-08", row);
  const hiddenBody = meterBody(hidden, "2026-11-08", row);
  it.each([
    ["no streak", undefined],
    ["a null streak", null],
    ["a bare number", 3],
    ["a fractional current", { current: 1.5, best: 9 }],
    ["a negative current", { current: -1, best: 9 }],
    ["a text best", { current: 4, best: "9" }],
    ["a best below the current run", { current: 5, best: 4 }],
  ])("rejects a streak with %s, open or hidden", (_name, bad) => {
    expect(isMeterBody({ ...openBody, streak: bad })).toBe(false);
    expect(isMeterBody({ ...hiddenBody, streak: bad })).toBe(false);
  });

  it.each([
    ["not an object", "open"],
    ["null", null],
    ["an unparseable deadline", { ...openBody, closesAt: "soon" }],
    ["a text threshold", { ...openBody, threshold: "0.6" }],
    ["an infinite rate", { ...openBody, passRate: Infinity }],
    ["a fractional attempt count", { ...openBody, attempts: 1.5 }],
    ["a negative attempt count", { ...openBody, attempts: -1 }],
    ["an unknown status", { ...openBody, status: "closed" }],
  ])("rejects a reply with %s", (_name, reply) => {
    expect(isMeterBody(reply)).toBe(false);
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

describe("with METER_HIDE_HOURS at 0: shown until the deadline (T103)", () => {
  beforeEach(() => {
    config.hideHours = 0;
  });

  it.each(["2026-11-08T00:00:00Z", "2026-11-08T21:00:00Z", "2026-11-08T23:59:59.999Z"])("is open at %s", (now) => {
    const body = meterBody(new Date(now), "2026-11-08", row);
    expect(body).toMatchObject({ status: "open", passRate: 0.75, attempts: 12 });
  });

  it("hides from nothing earlier than the deadline itself", () => {
    expect(meterHiddenFrom(closesAt).toISOString()).toBe(closesAt);
  });

  it("caches an open reading right up to the deadline, counting the stale grace", () => {
    const body = meterBody(new Date("2026-11-08T21:00:00Z"), "2026-11-08", row);
    expect(meterCacheSeconds(body, new Date("2026-11-08T21:00:00Z"))).toBe(30);
    expect(meterCacheSeconds(body, new Date("2026-11-08T23:59:10Z"))).toBe(25);
    expect(meterCacheSeconds(body, new Date("2026-11-08T23:59:59Z"))).toBe(0);
  });
});

describe("meterHiddenMessage", () => {
  it.each([
    [3, "The meter is hidden for the final 3 hours. The result is revealed at the deadline."],
    [2, "The meter is hidden for the final 2 hours. The result is revealed at the deadline."],
    [1, "The meter is hidden for the final hour. The result is revealed at the deadline."],
    [0, "The meter is hidden until the deadline, when the result is revealed."],
  ])("reads correctly for %i hours", (hours, message) => {
    expect(meterHiddenMessage(hours)).toBe(message);
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

