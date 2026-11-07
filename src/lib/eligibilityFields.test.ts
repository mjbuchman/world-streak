import { describe, expect, it } from "vitest";
import { validateEligibilityFields } from "./eligibilityFields";

const TODAY = "2026-11-07";
const valid = { birthDate: "1990-05-05", country: " us ", agree: "on" };

describe("validateEligibilityFields", () => {
  it("returns the cleaned values for an eligible applicant", () => {
    expect(validateEligibilityFields(valid, TODAY)).toEqual({
      status: "ok",
      data: { birthDate: "1990-05-05", country: "US" },
    });
  });

  it("refuses a valid but underage applicant", () => {
    expect(validateEligibilityFields({ ...valid, birthDate: "2008-11-08" }, TODAY)).toEqual({ status: "refused" });
  });

  it("refuses a resident of another country", () => {
    expect(validateEligibilityFields({ ...valid, country: "CA" }, TODAY)).toEqual({ status: "refused" });
  });

  it.each(["2001-02-30", "2027-01-01", "1906-11-06", "", undefined])(
    "reports a field error, not a refusal, for the birth date %j",
    (birthDate) => {
      expect(validateEligibilityFields({ ...valid, birthDate }, TODAY)).toEqual({
        status: "invalid",
        fieldErrors: { birthDate: "Enter a valid date of birth." },
      });
    },
  );

  it("asks for a country when none is given", () => {
    expect(validateEligibilityFields({ ...valid, country: undefined }, TODAY)).toEqual({
      status: "invalid",
      fieldErrors: { country: "Select your country of residence." },
    });
  });

  it("requires agreeing to the official rules", () => {
    expect(validateEligibilityFields({ ...valid, agree: undefined }, TODAY)).toEqual({
      status: "invalid",
      fieldErrors: { agree: "You need to agree to the official rules." },
    });
  });

  it("reports field errors instead of a refusal when both apply", () => {
    expect(validateEligibilityFields({ birthDate: "2015-01-01", country: "CA", agree: undefined }, TODAY)).toEqual({
      status: "invalid",
      fieldErrors: { agree: "You need to agree to the official rules." },
    });
  });
});
