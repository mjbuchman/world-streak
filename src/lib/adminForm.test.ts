import { describe, expect, it } from "vitest";
import { inTowerRange, numberField, refuse, STACKING_TARGET_RANGE, towerRowMessage } from "@/lib/adminForm";

const first = (raw: string) => {
  const parsed = numberField("Pass target").safeParse(raw);
  return parsed.success ? parsed.data : parsed.error.issues[0].message;
};

describe("numberField", () => {
  it("refuses empty and blank input as required", () => {
    expect(first("")).toBe("Pass target is required.");
    expect(first("   ")).toBe("Pass target is required.");
  });

  it("refuses non-numeric and infinite input", () => {
    expect(first("ten")).toBe("Pass target must be a number.");
    expect(first("Infinity")).toBe("Pass target must be a number.");
  });

  it("trims and parses a number", () => {
    expect(first(" 12.5 ")).toBe(12.5);
  });
});

describe("the Tower's target range", () => {
  it("accepts rows 1 to 15 only", () => {
    expect(STACKING_TARGET_RANGE).toEqual({ min: 1, max: 15 });
    expect([0, 1, 15, 16].map(inTowerRange)).toEqual([false, true, true, false]);
  });

  it("names the field and the range", () => {
    expect(towerRowMessage("The Teetering Tower's pass target")).toBe("The Teetering Tower's pass target must be a row from 1 to 15.");
  });
});

describe("refuse", () => {
  it("is a failed state with the message", () => {
    expect(refuse("No.")).toEqual({ ok: false, message: "No." });
  });
});
