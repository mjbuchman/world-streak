import { describe, expect, it } from "vitest";
import { passes } from "./pass";

describe("passes", () => {
  it("needs at least the target when higher is better", () => {
    expect(passes(10, 10, "higher-better")).toBe(true);
    expect(passes(9.9, 10, "higher-better")).toBe(false);
  });

  it("needs at most the target when lower is better (for example a time)", () => {
    expect(passes(10, 10, "lower-better")).toBe(true);
    expect(passes(10.1, 10, "lower-better")).toBe(false);
    expect(passes(3, 10, "lower-better")).toBe(true);
  });
});
