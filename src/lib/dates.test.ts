import { describe, expect, it } from "vitest";
import { calendarDateIn, dayLabel, eligibilityToday, instantLabel, longDayLabel } from "./dates";

describe("UTC labels (T126)", () => {
  it("formats a game date short, in UTC whatever the local zone", () => {
    expect(dayLabel("2026-11-01")).toBe("Nov 1, 2026");
  });
  it("formats a date long", () => {
    expect(longDayLabel("2027-01-01")).toBe("January 1, 2027");
  });
  it("formats an instant in UTC", () => {
    expect(instantLabel("2026-11-12T15:04:00Z")).toBe("Nov 12, 2026, 3:04 PM");
  });
});

describe("calendarDateIn", () => {
  it("returns the calendar date in the given time zone", () => {
    const now = new Date("2026-11-08T05:00:00Z");
    expect(calendarDateIn("UTC", now)).toBe("2026-11-08");
    expect(calendarDateIn("America/New_York", now)).toBe("2026-11-08");
    expect(calendarDateIn("Pacific/Honolulu", now)).toBe("2026-11-07");
  });

  it("pads single-digit months and days", () => {
    expect(calendarDateIn("UTC", new Date("2026-03-04T12:00:00Z"))).toBe("2026-03-04");
  });
});

describe("eligibilityToday", () => {
  it("uses the earliest US date, so UTC midnight does not advance anyone's birthday", () => {
    // 06:00 UTC on Nov 8 is still the evening of Nov 7 in Hawaii.
    expect(eligibilityToday(new Date("2026-11-08T06:00:00Z"))).toBe("2026-11-07");
  });

  it("moves to the next day once it is midnight in Hawaii", () => {
    expect(eligibilityToday(new Date("2026-11-08T10:00:00Z"))).toBe("2026-11-08");
  });
});
