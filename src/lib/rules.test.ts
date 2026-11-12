import { describe, expect, it } from "vitest";
import { deadlineLabel, isDraft, RULES_CONFIG, rulesSections, type RulesConfig } from "./rules";

const text = (config: RulesConfig) =>
  rulesSections(config)
    .flatMap((section) => [section.heading, ...section.paragraphs])
    .join("\n");

describe("rulesSections", () => {
  it("states every rule the design asks for, with today's values", () => {
    const rules = text(RULES_CONFIG);
    for (const phrase of [
      "No purchase or payment of any kind is necessary",
      "legal residents of the United States who are at least 18 years old",
      "checked when you create an account",
      "One account per person",
      "one scored attempt per game day",
      "Each game day ends at midnight UTC",
      "resets to zero for everyone",
      "cycles of 60 days",
      "The first cycle starts January 1, 2027",
      "a 30-day world streak",
      "The prize is $200 per cycle",
      "the whole prize rolls over to the next cycle",
      "earns one entry",
      "one winner is drawn at random from all of that cycle's entries",
      "lose their entries",
      "must verify their email address before payout",
      "paid within 45 days of the cycle ending",
    ]) {
      expect(rules).toContain(phrase);
    }
  });

  it("takes every number from the config", () => {
    const changed = text({
      ...RULES_CONFIG,
      minAge: 21,
      prizeCents: 50_000,
      cycleLengthDays: 90,
      streakGoalDays: 45,
      firstCycleStart: "2027-02-01",
      payoutWithinDays: 30,
      deadlineUtcHour: 5,
      countries: ["Canada", "Mexico"],
    });
    for (const phrase of [
      "at least 21 years old",
      "The prize is $500 per cycle",
      "cycles of 90 days",
      "a 45-day world streak",
      "The first cycle starts February 1, 2027",
      "paid within 30 days",
      "ends at 05:00 UTC",
      "legal residents of Canada or Mexico",
    ]) {
      expect(changed).toContain(phrase);
    }
    expect(changed).not.toContain("18 years");
    expect(changed).not.toContain("$200");
  });

  it("never mentions a prize formula, floor, cap or revenue share", () => {
    expect(text(RULES_CONFIG)).not.toMatch(/formula|floor|\bcaps?\b|revenue|share/i);
  });

  it("names the sponsor and how to reach them", () => {
    const rules = text({ ...RULES_CONFIG, sponsor: { name: "Acme LLC", address: "1 Main St, Springfield", email: "rules@example.com" } });
    expect(rules).toContain("Acme LLC, 1 Main St, Springfield. Questions: rules@example.com.");
  });
});

describe("isDraft", () => {
  it("is a draft while any sponsor detail is still a placeholder", () => {
    expect(isDraft(RULES_CONFIG.sponsor)).toBe(true);
    const filled = { name: "Acme LLC", address: "1 Main St", email: "rules@example.com" };
    expect(isDraft(filled)).toBe(false);
    expect(isDraft({ ...filled, email: "[Sponsor contact email]" })).toBe(true);
  });
});

describe("deadlineLabel", () => {
  it.each([
    [0, "midnight UTC"],
    [12, "noon UTC"],
    [5, "05:00 UTC"],
    [17, "17:00 UTC"],
  ])("says hour %i as %s", (hour, label) => {
    expect(deadlineLabel(hour)).toBe(label);
  });
});
