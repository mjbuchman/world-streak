import { describe, expect, it } from "vitest";
import type { MeterBody } from "./meter";
import { buildShareText, meterBar } from "./share";

const closesAt = "2026-11-13T00:00:00.000Z";
const streak = { current: 12, best: 30 };
const open = (passRate: number | null, threshold: number | null = 0.6): MeterBody => ({
  gameDate: "2026-11-12",
  status: "open",
  passRate,
  attempts: 1234,
  threshold,
  closesAt,
  streak,
});
const base = { passed: true, gameDate: "2026-11-12", streak: 12, siteUrl: "https://example.test" };

describe("meterBar", () => {
  it.each([
    [0.7, 0.6, "🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜"],
    [0.6, 0.6, "🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜"],
    [0.52, 0.6, "🟧🟧🟧🟧🟧⬜⬜⬜⬜⬜"],
    [0.04, 0.6, "⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜"],
    [1, 0.6, "🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩"],
  ])("at %d with %d needed: %s", (passRate, threshold, bar) => {
    expect(meterBar(passRate, threshold)).toBe(bar);
  });

  it("colours by the real comparison, not the rounded squares", () => {
    // 0.598 fills 6 squares, like the line itself, but is below it.
    expect(meterBar(0.598, 0.6)).toBe("🟧🟧🟧🟧🟧🟧⬜⬜⬜⬜");
  });
});

describe("buildShareText", () => {
  it("says the game, the date, the outcome, the world streak, the meter and the site", () => {
    expect(buildShareText({ ...base, meter: open(0.7) })).toBe(
      [
        "World Streak · Nov 12, 2026",
        "✅ I passed today's challenge.",
        "🔥 World streak: 12 days",
        "🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜ 70% today, 60% needed",
        "https://example.test",
      ].join("\n"),
    );
  });

  it("differs between a pass and a fail only in the outcome line", () => {
    const pass = buildShareText({ ...base, meter: open(0.63) }).split("\n");
    const fail = buildShareText({ ...base, passed: false, meter: open(0.63) }).split("\n");
    expect(fail[1]).toBe("❌ I didn't make it today.");
    expect(fail.filter((line, i) => line !== pass[i])).toEqual(["❌ I didn't make it today."]);
  });

  it.each([0.63, 0.52, 0.649])("at %d passing with 0.6 needed, calls for help", (passRate) => {
    const lines = buildShareText({ ...base, meter: open(passRate) }).split("\n");
    expect(lines[3]).toBe(`${meterBar(passRate, 0.6)} ${Math.round(passRate * 100)}% today, 60% needed`);
    expect(lines[4]).toBe("🆘 The world is close to the line. We need you: play before the deadline!");
  });

  it.each([0.65, 0.7])("at %d passing with 0.6 needed, does not call for help", (passRate) => {
    expect(buildShareText({ ...base, meter: open(passRate) })).not.toMatch(/🆘|We need you/);
  });

  it("shows no rate or bar while the meter is hidden", () => {
    const hidden: MeterBody = { gameDate: "2026-11-12", status: "hidden", threshold: 0.6, closesAt, streak };
    const text = buildShareText({ ...base, meter: hidden });
    expect(text.split("\n")[3]).toBe("🙈 The meter is hidden. Every attempt counts!");
    expect(text).not.toMatch(/%|🟩|🟧|⬜/);
  });

  it("leaves out the world's lines when the meter has nothing to say yet, or could not be read", () => {
    for (const meter of [open(null), open(0.7, null), null]) {
      expect(buildShareText({ ...base, meter }).split("\n")).toEqual([
        "World Streak · Nov 12, 2026",
        "✅ I passed today's challenge.",
        "🔥 World streak: 12 days",
        "https://example.test",
      ]);
    }
  });

  it("leaves out the streak when it could not be read", () => {
    expect(buildShareText({ ...base, streak: null, meter: null })).not.toMatch(/World streak/);
  });

  it("says 1 day, not 1 days", () => {
    expect(buildShareText({ ...base, streak: 1, meter: null })).toContain("🔥 World streak: 1 day");
    expect(buildShareText({ ...base, streak: 1, meter: null })).not.toContain("1 days");
  });

  it("never gives away the score, the target, the instance or the challenge (it takes none of them)", () => {
    const text = buildShareText({ ...base, meter: open(0.7) });
    // The inputs carry none of these, so the text cannot: check the words people would look for.
    expect(text).not.toMatch(/row|score|target|dots|seconds|Tower|Second Sense|Swift Sum/i);
    // @ts-expect-error -- a score is not something the card accepts.
    buildShareText({ ...base, meter: null, score: 7 });
  });
});
