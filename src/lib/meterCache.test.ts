import { describe, expect, it, vi } from "vitest";
import { METER_CACHE_SECONDS, METER_STALE_MAX_SECONDS } from "@/config/meter";
import type { MeterBody } from "./meter";
import { createMeterCache } from "./meterCache";

const START = Date.parse("2026-11-08T12:00:00Z");
const body = (attempts: number): MeterBody => ({
  gameDate: "2026-11-08",
  status: "open",
  passRate: 0.5,
  attempts,
  threshold: 0.6,
  closesAt: "2026-11-09T00:00:00.000Z",
  streak: { current: 1, best: 2 },
});

/** A cache over a counting read and a clock the test moves. */
function setup() {
  let now = START;
  let reads = 0;
  const read = vi.fn(async () => body(++reads));
  const cache = createMeterCache({ read, now: () => new Date(now) });
  return { cache, read, advance: (ms: number) => (now += ms) };
}

describe("createMeterCache", () => {
  it("answers 500 calls in one window with exactly one database read", async () => {
    const { cache, read } = setup();
    const answers = await Promise.all(Array.from({ length: 500 }, () => cache.get()));
    expect(read).toHaveBeenCalledTimes(1);
    expect(new Set(answers.map((answer) => answer?.body.status === "open" && answer.body.attempts))).toEqual(new Set([1]));
    expect(answers.every((answer) => answer?.stale === false)).toBe(true);
  });

  it("reads once more after the window", async () => {
    const { cache, read, advance } = setup();
    await cache.get();
    advance(METER_CACHE_SECONDS * 1000 - 1);
    await cache.get();
    expect(read).toHaveBeenCalledTimes(1);
    advance(1);
    expect(await cache.get()).toMatchObject({ body: { attempts: 2 }, stale: false });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps a reading only as long as it may be cached, so never past its window's end", async () => {
    const { cache, read, advance } = setup();
    // 20 s before the deadline a reading may be kept for 10 s.
    advance(Date.parse("2026-11-08T23:59:40Z") - START);
    await cache.get();
    advance(9_999);
    await cache.get();
    expect(read).toHaveBeenCalledTimes(1);
    advance(1);
    await cache.get();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("serves the last good reading, marked stale, while the database fails, for up to 5 minutes", async () => {
    const { cache, read, advance } = setup();
    await cache.get();
    read.mockRejectedValue(new Error("down"));
    advance(METER_CACHE_SECONDS * 1000);
    expect(await cache.get()).toEqual({ body: body(1), stale: true });
    advance(METER_STALE_MAX_SECONDS * 1000 - METER_CACHE_SECONDS * 1000);
    expect(await cache.get()).toEqual({ body: body(1), stale: true });
    advance(1);
    expect(await cache.get()).toBeNull();
  });

  it("serves nothing when the very first read fails, and shares one failing read between callers", async () => {
    const { cache, read } = setup();
    read.mockRejectedValue(new Error("down"));
    expect(await Promise.all([cache.get(), cache.get()])).toEqual([null, null]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("never serves a stale reading past the moment it goes out of date", async () => {
    const { cache, read, advance } = setup();
    advance(Date.parse("2026-11-08T23:58:00Z") - START);
    await cache.get();
    read.mockRejectedValue(new Error("down"));
    // Within 5 minutes of the good read, but after the deadline: yesterday's meter is not shown.
    advance(2 * 60_000);
    expect(await cache.get()).toBeNull();
  });

  it("recovers on the next good read", async () => {
    const { cache, read, advance } = setup();
    await cache.get();
    read.mockRejectedValueOnce(new Error("down"));
    advance(METER_CACHE_SECONDS * 1000);
    expect(await cache.get()).toMatchObject({ stale: true });
    expect(await cache.get()).toMatchObject({ body: { attempts: 2 }, stale: false });
  });
});
