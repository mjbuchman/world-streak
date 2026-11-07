import { describe, expect, it } from "vitest";
import { ALLOWED_COUNTRIES, MIN_AGE } from "@/config/eligibility";
import { checkEligibility } from "./eligibility";

const TODAY = "2026-11-07";

describe("eligibility config", () => {
  it("allows US residents aged 18 and over", () => {
    expect(MIN_AGE).toBe(18);
    expect(ALLOWED_COUNTRIES).toEqual(["US"]);
  });
});

describe("checkEligibility", () => {
  it("accepts someone whose 18th birthday is today", () => {
    expect(checkEligibility({ birthDate: "2008-11-07", country: "US" }, TODAY)).toEqual({ eligible: true });
  });

  it("refuses someone who turns 18 tomorrow", () => {
    expect(checkEligibility({ birthDate: "2008-11-08", country: "US" }, TODAY)).toEqual({
      eligible: false,
      reason: "underage",
    });
  });

  it("refuses someone whose birthday is later this year at the boundary age", () => {
    expect(checkEligibility({ birthDate: "2008-12-01", country: "US" }, TODAY)).toEqual({
      eligible: false,
      reason: "underage",
    });
  });

  it("accepts a much older adult", () => {
    expect(checkEligibility({ birthDate: "1950-01-01", country: "US" }, TODAY)).toEqual({ eligible: true });
  });

  it("treats a Feb 29 birthday as reached on Mar 1 in a non-leap year", () => {
    const leapling = { birthDate: "2008-02-29", country: "US" };
    expect(checkEligibility(leapling, "2026-03-01")).toEqual({ eligible: true });
    expect(checkEligibility(leapling, "2026-02-28")).toEqual({ eligible: false, reason: "underage" });
  });

  it("refuses countries outside the allowed list", () => {
    expect(checkEligibility({ birthDate: "1990-05-05", country: "CA" }, TODAY)).toEqual({
      eligible: false,
      reason: "region",
    });
  });

  it("accepts the country code in any case and with surrounding spaces", () => {
    expect(checkEligibility({ birthDate: "1990-05-05", country: "us" }, TODAY)).toEqual({ eligible: true });
    expect(checkEligibility({ birthDate: "1990-05-05", country: " Us " }, TODAY)).toEqual({ eligible: true });
  });

  it.each([
    ["a future date", "2030-01-01"],
    ["a date after today by one day", "2026-11-08"],
    ["an impossible calendar date", "2001-02-30"],
    ["Feb 29 in a non-leap year", "2001-02-29"],
    ["month 13", "2001-13-01"],
    ["the wrong format", "11/07/2001"],
    ["an empty string", ""],
  ])("reports invalid-date for %s", (_label, birthDate) => {
    expect(checkEligibility({ birthDate, country: "US" }, TODAY)).toEqual({
      eligible: false,
      reason: "invalid-date",
    });
  });

  it("reports invalid-date before checking the region", () => {
    expect(checkEligibility({ birthDate: "not-a-date", country: "CA" }, TODAY)).toEqual({
      eligible: false,
      reason: "invalid-date",
    });
  });

  it("reports underage before checking the region", () => {
    expect(checkEligibility({ birthDate: "2015-01-01", country: "CA" }, TODAY)).toEqual({
      eligible: false,
      reason: "underage",
    });
  });

  it("rejects an invalid today value instead of guessing", () => {
    expect(() => checkEligibility({ birthDate: "1990-01-01", country: "US" }, "2026-13-40")).toThrow(/today/);
  });

  it("uses injected rules: a minimum age of 21 makes 2005-11-08 underage on 2026-11-07", () => {
    const rules = { minAge: 21, allowedCountries: ["US"] };
    expect(checkEligibility({ birthDate: "2005-11-08", country: "US" }, TODAY, rules)).toEqual({
      eligible: false,
      reason: "underage",
    });
    expect(checkEligibility({ birthDate: "2005-11-07", country: "US" }, TODAY, rules)).toEqual({ eligible: true });
  });

  it("uses injected rules: other allowed countries", () => {
    const rules = { minAge: MIN_AGE, allowedCountries: ["US", "CA"] };
    expect(checkEligibility({ birthDate: "1990-05-05", country: "ca" }, TODAY, rules)).toEqual({ eligible: true });
  });
});
