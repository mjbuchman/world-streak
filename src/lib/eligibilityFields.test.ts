import { describe, expect, it } from "vitest";
import { validateEligibilityFields } from "./eligibilityFields";

const TODAY = "2026-11-07";
const valid = { birthDate: "1990-05-05", country: " us ", agree: "on" };

describe("validateEligibilityFields", () => {
  it("returns the cleaned values for an eligible applicant", () => {
    expect(validateEligibilityFields(valid, TODAY)).toEqual({
      fieldErrors: {},
      refused: false,
      data: { birthDate: "1990-05-05", country: "US" },
    });
  });

  it("refuses an eligible-looking but underage applicant, with no field errors", () => {
    expect(validateEligibilityFields({ ...valid, birthDate: "2008-11-08" }, TODAY)).toEqual({
      fieldErrors: {},
      refused: true,
      data: null,
    });
  });

  it("refuses a resident of another country", () => {
    expect(validateEligibilityFields({ ...valid, country: "CA" }, TODAY)).toMatchObject({ refused: true, data: null });
  });

  it.each(["2001-02-30", "2027-01-01", "1906-11-06", "", undefined])(
    "reports a field error, not a refusal, for the birth date %j",
    (birthDate) => {
      expect(validateEligibilityFields({ ...valid, birthDate }, TODAY)).toEqual({
        fieldErrors: { birthDate: "Enter a valid date of birth." },
        refused: false,
        data: null,
      });
    },
  );

  it("asks for a country when none is given", () => {
    expect(validateEligibilityFields({ ...valid, country: undefined }, TODAY)).toMatchObject({
      fieldErrors: { country: "Select your country of residence." },
      refused: false,
      data: null,
    });
  });

  it("requires agreeing to the official rules", () => {
    expect(validateEligibilityFields({ ...valid, agree: undefined }, TODAY)).toMatchObject({
      fieldErrors: { agree: "You need to agree to the official rules." },
      refused: false,
      data: null,
    });
  });

  it("reports field errors instead of a refusal when both apply", () => {
    const result = validateEligibilityFields({ birthDate: "2015-01-01", country: "CA", agree: undefined }, TODAY);
    expect(result).toMatchObject({ refused: false, fieldErrors: { agree: expect.any(String) } });
  });
});
