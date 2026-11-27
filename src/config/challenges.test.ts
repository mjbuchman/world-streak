import { describe, expect, it } from "vitest";
import { BANK_MS, WORDS } from "@/challenges/ink/engine";
import { CHALLENGE_NAMES, CHALLENGE_TAGLINES, INK_HOW_TO, practicePath } from "./challenges";

describe("challenge names (T201)", () => {
  it("shows the renamed games under their new names while the stored keys and routes stay", () => {
    expect(CHALLENGE_NAMES["echo-path"]).toBe("Trail Trace");
    expect(CHALLENGE_NAMES["fair-split"]).toBe("Clean Cut");
    expect(Object.keys(CHALLENGE_NAMES)).toEqual(["stacking", "inner-clock", "flash-count", "echo-path", "fair-split", "ink"]);
    expect(practicePath("echo-path")).toBe("/practice/echo-path");
    expect(practicePath("fair-split")).toBe("/practice/fair-split");
  });

  it("shows ink as Confusing Colors, with its 30 words and 3.2 s bank in the how-to and tagline (T239)", () => {
    expect(CHALLENGE_NAMES.ink).toBe("Confusing Colors");
    expect(practicePath("ink")).toBe("/practice/ink");
    expect(INK_HOW_TO).toMatch(/^Tap the colour of the ink, not the word\. Keys 1 to 4 also work\. Press Start for 30 colour words.*3\.2 s time bank.*Survive all 30 words\.$/);
    expect(CHALLENGE_TAGLINES.ink).toMatch(/^30 colour words in a row: tap the colour of the ink, not the word\./);
  });

  it("states the engine's own word count and bank, so the text cannot drift from the rules", () => {
    expect(INK_HOW_TO).toContain(`${WORDS} colour words`);
    expect(INK_HOW_TO).toContain(`${(BANK_MS / 1000).toFixed(1)} s time bank`);
    expect(CHALLENGE_TAGLINES.ink).toContain(`${WORDS} colour words`);
  });
});
