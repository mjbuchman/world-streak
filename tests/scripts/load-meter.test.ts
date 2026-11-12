import { describe, expect, it } from "vitest";
import { assertLocalTarget, LOAD, percentile, summary } from "../../scripts/load-meter.mts";

describe("load:meter", () => {
  it("runs 200 connections for 30 s", () => {
    expect(LOAD).toEqual({ connections: 200, durationSeconds: 30 });
  });

  it("refuses any server but this machine", () => {
    expect(assertLocalTarget("http://localhost:3200").port).toBe("3200");
    expect(assertLocalTarget("http://127.0.0.1:3000").hostname).toBe("127.0.0.1");
    expect(() => assertLocalTarget("https://world-streak.vercel.app")).toThrow("Refusing to load-test https://world-streak.vercel.app");
  });

  it("takes percentiles by nearest rank", () => {
    const samples = Array.from({ length: 100 }, (_, i) => 100 - i); // 100 down to 1, unsorted order
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 100)).toBe(100);
    expect(percentile(samples, 0)).toBe(1);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBeNull();
  });

  it("prints the request count and the latency figures", () => {
    expect(summary([10, 20, 30], 0, 0)).toEqual([
      "Requests: 3 (0/s), non-2xx: 0, errors: 0",
      "p50 20 ms, p95 30 ms, p99 30 ms (target: p95 under 200 ms locally)",
    ]);
    expect(summary([], 1, 2)[1]).toBe("p50 - ms, p95 - ms, p99 - ms (target: p95 under 200 ms locally)");
    expect(summary([62.9985, 403.2964], 0, 0)[1]).toBe("p50 63 ms, p95 403 ms, p99 403 ms (target: p95 under 200 ms locally)");
  });
});
