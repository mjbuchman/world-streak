import { describe, expect, it } from "vitest";
import { CHALLENGE_NAMES, practicePath } from "./challenges";

describe("challenge names (T201)", () => {
  it("shows the renamed games under their new names while the stored keys and routes stay", () => {
    expect(CHALLENGE_NAMES["echo-path"]).toBe("Trail Trace");
    expect(CHALLENGE_NAMES["fair-split"]).toBe("Clean Cut");
    expect(Object.keys(CHALLENGE_NAMES)).toEqual(["stacking", "inner-clock", "flash-count", "echo-path", "fair-split"]);
    expect(practicePath("echo-path")).toBe("/practice/echo-path");
    expect(practicePath("fair-split")).toBe("/practice/fair-split");
  });
});
