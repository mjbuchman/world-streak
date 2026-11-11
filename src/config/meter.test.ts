import { describe, expect, it } from "vitest";
import { METER_CACHE_SECONDS, METER_HIDE_HOURS, METER_POLL_SECONDS } from "./meter";

describe("meter settings", () => {
  it("hides the meter for the final 3 hours and caches readings for 30 s (T18)", () => {
    expect(METER_HIDE_HOURS).toBe(3);
    expect(METER_CACHE_SECONDS).toBe(30);
  });

  it("polls the meter every 60 s (T19)", () => {
    expect(METER_POLL_SECONDS).toBe(60);
  });
});
