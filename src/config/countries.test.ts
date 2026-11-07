import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS } from "./countries";
import { ALLOWED_COUNTRIES } from "./eligibility";

describe("COUNTRY_OPTIONS", () => {
  const codes = COUNTRY_OPTIONS.map((option) => option.code);

  it("offers every allowed country, so eligible people can pick theirs", () => {
    for (const allowed of ALLOWED_COUNTRIES) expect(codes).toContain(allowed);
  });

  it("uses unique upper-case two-letter codes, matching the profiles.country check", () => {
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("gives every option a name", () => {
    for (const { name } of COUNTRY_OPTIONS) expect(name.trim()).not.toBe("");
  });
});
